import db from "../db.js";
import { getInstructorId } from "../middlewares/auth_middlewares.js";


// ======================= Get All Courses (Public) =======================

export const getAllCourses = async (req, res) => {
  const result = await db.query(`
    SELECT c.id, c.title, c.description, c.category, c.level, c.duration, c.price, c.discount_percent,rating, c.banner_url, c.created_at, u.name AS instructor
    FROM courses c
    JOIN instructors i ON c.instructor_id = i.id
    JOIN users u ON i.user_id = u.id
    ORDER BY c.created_at DESC
  `);

  res.json({ success: true, courses: result.rows });
};


// ======================= Get Course by ID (Public) =======================

export const getCourseById = async (req, res) => {
  const { courseId } = req.params;

  const course = await db.query(
    `SELECT * FROM courses WHERE id = $1`,
    [courseId]
  );

  if (!course.rows.length) {
    return res.status(404).json({ success: false, message: "Course not found" });
  }

  const lessons = await db.query(
    "SELECT * FROM lessons WHERE course_id = $1 ORDER BY order_index",
    [courseId]
  );

  res.json({
    success: true,
    course: course.rows[0],
    lessons: lessons.rows,
  });
};


// ======================= Create Course (Instructor Only) =======================

export const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      level,
      duration,
      price,
      discount_percent,
      banner_url,
    } = req.body;

    if (!title || !level || !price) {
      return res.status(400).json({
        success: false,
        message: "Title, level and price are required",
      });
    }

    let instructorId = null;

    // Admin can create courses for any instructor (optional future extension)
    if (req.user.role === "instructor") {
      instructorId = await getInstructorId(req.user.id);

      if (!instructorId) {
        return res.status(403).json({
          success: false,
          message: "Instructor profile not found",
        });
      }
    }

    // Admin creating course (fallback)
    if (req.user.role === "admin") {
      instructorId = req.body.instructor_id;
      if (!instructorId) {
        return res.status(400).json({
          success: false,
          message: "Instructor ID required for admin course creation",
        });
      }
    }

    const result = await db.query(
      `INSERT INTO courses
      (title, description, category, level, duration, price, discount_percent, banner_url, instructor_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        title,
        description,
        category,
        level,
        duration,
        price,
        discount_percent || 0,
        banner_url,
        instructorId,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course: result.rows[0],
    });

  } catch (error) {
    console.error("CREATE COURSE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create course",
    });
  }
};


// ======================= Update Course (Instructor Owner / Admin) =======================

export const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      title,
      description,
      category,
      level,
      duration,
      price,
      discount_percent,
      banner_url,
    } = req.body;

    const courseRes = await db.query(
      "SELECT instructor_id FROM courses WHERE id = $1",
      [courseId]
    );

    if (!courseRes.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Ownership check (skip for admin)
    if (req.user.role !== "admin") {
      const instructorId = await getInstructorId(req.user.id);

      if (courseRes.rows[0].instructor_id !== instructorId) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to update this course",
        });
      }
    }

    await db.query(
      `UPDATE courses
       SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         level = COALESCE($4, level),
         duration = COALESCE($5, duration),
         price = COALESCE($6, price),
         discount_percent = COALESCE($7, discount_percent),
         banner_url = COALESCE($8, banner_url),
         updated_at = NOW()
       WHERE id = $9`,
      [
        title,
        description,
        category,
        level,
        duration,
        price,
        discount_percent,
        banner_url,
        courseId,
      ]
    );

    res.json({
      success: true,
      message: "Course updated successfully",
    });

  } catch (error) {
    console.error("UPDATE COURSE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update course",
    });
  }
};


// ======================= Delete Course =======================

export const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const courseRes = await db.query(
      "SELECT instructor_id FROM courses WHERE id = $1",
      [courseId]
    );

    if (!courseRes.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Ownership check (admin bypass)
    if (req.user.role !== "admin") {
      const instructorId = await getInstructorId(req.user.id);
      if (courseRes.rows[0].instructor_id !== instructorId) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to delete this course",
        });
      }
    }

    await db.query("DELETE FROM courses WHERE id = $1", [courseId]);

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });

  } catch (error) {
    console.error("DELETE COURSE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete course",
    });
  }
};




