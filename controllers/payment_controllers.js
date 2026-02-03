import db from "../config/db.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import "dotenv/config";
import { sendEmail } from "../config/emailService.js";
import { customerBookedTemplate, dealerBookedTemplate } from "../templates/emailTemplates.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



export async function previewBookingDetails(req, res) {
  try {
    const { carId, booking_date } = req.query;
    const userId = req.user.id;

    if (!carId || !booking_date) {
      return res.status(400).json({
        success: false,
        message: "carId and booking_date are required",
      });
    }

    /* -------- Validate date format (YYYY-MM-DD) -------- */
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(booking_date)) {
      return res.status(400).json({
        success: false,
        message: "booking_date must be in YYYY-MM-DD format",
      });
    }

    const selectedDate = new Date(booking_date);
    const today = new Date();

    // remove time part
    today.setHours(0, 0, 0, 0);

    // calculate tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    /* -------- Allow only from NEXT DAY -------- */
    if (selectedDate < tomorrow) {
      return res.status(400).json({
        success: false,
        message: "Booking is allowed only from tomorrow onwards",
      });
    }

    /* -------- Fetch car + dealer (NO phone) -------- */
    const query = `
      SELECT
        c.id,
        c.make,
        c.model,
        c.variant,
        c.price,

        d.id AS dealer_id,
        d.business_name,
        d.city
      FROM cars c
      JOIN dealers d ON c.dealer_id = d.id
      WHERE c.id = $1 AND c.is_available = TRUE
    `;

    const result = await db.query(query, [carId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Car not available",
      });
    }

    const car = result.rows[0];

    const platformFee = Number(process.env.PLATFORM_FEE || 500);

    return res.status(200).json({
      success: true,
      booking_preview: {
        car: {
          id: car.id,
          make: car.make,
          model: car.model,
          variant: car.variant,
          price: car.price, // display only
        },
        dealer: {
          id: car.dealer_id,
          business_name: car.business_name,
          city: car.city,
        },
        booking_date,
        platform_fee: platformFee,
        payable_now: platformFee,
        note: "Booking allowed only from tomorrow onwards. Remaining car amount will be paid directly to the dealer",
      },
    });
  } catch (error) {
    console.error("Preview booking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load booking preview",
    });
  }
}


export async function bookingCar(req, res) {
  const client = await db.connect();

  try {
    const userId = req.user.id;
    const { carId, booking_date } = req.body;

    if (!carId || !booking_date) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    await client.query("BEGIN");

    /* 🔒 Lock car */
    const carResult = await client.query(
      `SELECT id, dealer_id FROM cars WHERE id = $1 AND is_available = TRUE FOR UPDATE`,
      [carId]
    );

    if (carResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Car not available" });
    }

    const car = carResult.rows[0];

    /* 🔹 Create booking (PENDING STATE) */
    const bookingResult = await client.query(
      `
      INSERT INTO bookings (
        user_id, car_id, dealer_id, booking_date, platform_fee,
        payment_status, booking_status, dealer_payment_status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', 'pending', 'pending')
      RETURNING id
      `,
      [userId, carId, car.dealer_id, booking_date, process.env.PLATFORM_FEE || 500]
    );

    const bookingId = bookingResult.rows[0].id;

    /* 🔹 Create Razorpay Order */
    const order = await razorpay.orders.create({
      amount: Math.round((process.env.PLATFORM_FEE || 500) * 100),
      currency: "INR",
      receipt: bookingId,
    });

    /* 🔹 Create payment row (NO STATUS YET) */
    await client.query(
      `
      INSERT INTO payments (booking_id, payment_method, amount, razorpay_order_id)
      VALUES ($1, 'razorpay', $2, $3)
      `,
      [bookingId, process.env.PLATFORM_FEE || 500, order.id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      booking_id: bookingId,
      razorpay: {
        order_id: order.id,
        amount: order.amount,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ success: false, message: "Booking failed" });
  } finally {
    client.release();
  }
}



export async function verifyPayment(req, res) {
  const client = await db.connect();

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Signature mismatch" });
    }

    await client.query("BEGIN");

    /* 1️⃣ Update payments */
    const paymentResult = await client.query(
      `
      UPDATE payments
      SET payment_status = 'paid',
          transaction_id = $1
      WHERE razorpay_order_id = $2
      RETURNING booking_id
      `,
      [razorpay_payment_id, razorpay_order_id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const bookingId = paymentResult.rows[0].booking_id;

    /* 2️⃣ Update bookings */
    await client.query(
      `
      UPDATE bookings
      SET payment_status = 'paid',
          booking_status = 'confirmed',
          dealer_payment_status = 'pending',
          dealer_payment_reference = NULL
      WHERE id = $1
      `,
      [bookingId]
    );

    /* 3️⃣ Fetch booking + user + dealer info for emails */
    const infoResult = await client.query(
      `
      SELECT 
        u.email AS customer_email,
        u.first_name AS customer_name,

        d.business_name AS dealer_name,
        du.email AS dealer_email,

        c.make, c.model, c.variant,
        b.booking_date
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN dealers d ON b.dealer_id = d.id
      JOIN users du ON d.user_id = du.id
      JOIN cars c ON b.car_id = c.id
      WHERE b.id = $1
      `,
      [bookingId]
    );

    const info = infoResult.rows[0];
    const carName = `${info.make} ${info.model} ${info.variant || ""}`;

    await client.query("COMMIT");

    /* ================= SEND EMAILS ================= */

    // 📩 Email to Customer
    await sendEmail({
      to: info.customer_email,
      subject: "Your Car Booking is Confirmed 🚗",
      html: customerBookedTemplate({
        name: info.customer_name,
        car: carName,
        date: info.booking_date,
        dealerEmail: info.dealer_email,
      }),
    });

    // 📩 Email to Dealer
    await sendEmail({
      to: info.dealer_email,
      subject: "New Car Booking Received 🚗",
      html: dealerBookedTemplate({
        dealerName: info.dealer_name,
        customerName: info.customer_name,
        car: carName,
        date: info.booking_date,
        customerEmail: info.customer_email,
      }),
    });

    return res.json({
      success: true,
      booking_id: bookingId,
      message: "Payment verified, booking confirmed, notifications sent",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Verify payment error:", err);
    res.status(500).json({ success: false });
  } finally {
    client.release();
  }
}



export async function paymentFailed(req, res) {
  const client = await db.connect();

  try {
    const { razorpay_order_id } = req.body;

    if (!razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Order ID required" });
    }

    await client.query("BEGIN");

    /* 1️⃣ Update payments */
    const paymentResult = await client.query(
      `
      UPDATE payments
      SET payment_status = 'failed',
          transaction_id = razorpay_order_id
      WHERE razorpay_order_id = $1
      RETURNING booking_id
      `,
      [razorpay_order_id]
    );

    if (paymentResult.rows.length > 0) {
      const bookingId = paymentResult.rows[0].booking_id;

      /* 2️⃣ Update bookings */
      await client.query(
        `
        UPDATE bookings
        SET payment_status = 'failed',
            booking_status = 'cancelled',
            dealer_payment_status = 'failed',
            dealer_payment_reference = NULL
        WHERE id = $1
        `,
        [bookingId]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ success: false });
  } finally {
    client.release();
  }
}