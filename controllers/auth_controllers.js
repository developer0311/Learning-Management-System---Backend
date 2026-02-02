import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db.js";


const isStrongPassword = (password) => {
  // Minimum 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-{}[\]|\\:;"'<>,./]).{8,}$/;

  return strongPasswordRegex.test(password);
};


// ===================== POST REGISTER =====================

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // -------- Validation --------
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name, email, and password are required",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        error: "WEAK_PASSWORD",
        message:
          "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character",
      });
    }

    // -------- Check existing user --------
    const existingUser = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "EMAIL_EXISTS",
        message: "This email is already registered",
      });
    }

    // -------- Hash password --------
    const passwordHash = await bcrypt.hash(password, 10);

    // 🔒 FORCE ROLE = STUDENT
    const role = "student";

    // -------- Insert user --------
    const userResult = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, role]
    );

    const user = userResult.rows[0];

    // -------- JWT --------
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
      error: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong during registration",
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
        error: "VALIDATION_ERROR",
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
        error: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    // -------- Password match --------
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    // -------- JWT --------
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
      error: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong during login",
    });
  }
};


