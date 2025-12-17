import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db.js";


// ===================== POST REGISTER =====================

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // -------- Validation --------
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const allowedRoles = ["student", "instructor", "admin"];
    const userRole = allowedRoles.includes(role) ? role : "student";

    // -------- Check existing user --------
    const existingUser = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered",
      });
    }

    // -------- Hash password --------
    const passwordHash = await bcrypt.hash(password, 10);

    // -------- Insert user --------
    const userResult = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, userRole]
    );

    const user = userResult.rows[0];

    // -------- If instructor, create instructor profile --------
    if (user.role === "instructor") {
      await db.query(
        "INSERT INTO instructors (user_id) VALUES ($1)",
        [user.id]
      );
    }

    // -------- Generate JWT (7 days) --------
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user,
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};


// ===================== POST LOGIN =====================

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // -------- Validation --------
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // -------- Find user --------
    const result = await db.query(
      `SELECT id, name, email, password_hash, role
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Email not registered",
      });
    }

    const user = result.rows[0];

    // -------- Password match --------
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // -------- JWT (7 days) --------
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    delete user.password_hash;

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

