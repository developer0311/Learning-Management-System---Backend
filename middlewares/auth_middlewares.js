import jwt from "jsonwebtoken";
import db from "../db.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    // 1️⃣ Get token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2️⃣ If no token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    // 3️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded = { userId, role, iat, exp }

    // 4️⃣ Check if user still exists (important)
    const userResult = await db.query(
      `SELECT id, name, email, role
       FROM users
       WHERE id = $1`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    // 5️⃣ Attach user to request
    req.user = userResult.rows[0];

    next(); // 🚀 allow request to continue

  } catch (error) {
    console.error("AUTH ERROR:", error);

    // Token expired
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired, please login again",
      });
    }

    // Invalid token
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }
};



export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
    next();
  };
};



export const getInstructorId = async (userId) => {
  const result = await db.query(
    "SELECT id FROM instructors WHERE user_id = $1",
    [userId]
  );
  return result.rows[0]?.id;
};


export const isLessonOwnerOrAdmin = async (lessonId, user) => {
  // Admin has full access
  if (user.role === "admin") return true;

  if (user.role !== "instructor") return false;

  // Get instructor id
  const instructorRes = await db.query(
    "SELECT id FROM instructors WHERE user_id = $1",
    [user.id]
  );

  if (!instructorRes.rows.length) return false;

  const instructorId = instructorRes.rows[0].id;

  // Check lesson ownership
  const lessonRes = await db.query(
    `SELECT c.instructor_id
     FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = $1`,
    [lessonId]
  );

  if (!lessonRes.rows.length) return false;

  return lessonRes.rows[0].instructor_id === instructorId;
};
