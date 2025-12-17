import db from "../db.js";
import { getInstructorId } from "../middlewares/auth_middlewares.js";


// ======================= Add Lesson =======================

export const addLesson = async (req, res) => {
  const { courseId } = req.params;
  const { title, content_url, order_index } = req.body;

  // Get instructor id
  const instructorId = await getInstructorId(req.user.id);

  // Verify ownership
  const course = await db.query(
    "SELECT instructor_id FROM courses WHERE id = $1",
    [courseId]
  );

  if (!course.rows.length || course.rows[0].instructor_id !== instructorId) {
    return res.status(403).json({
      success: false,
      message: "You are not allowed to add lessons to this course",
    });
  }

  await db.query(
    `INSERT INTO lessons (course_id, title, content_url, order_index)
     VALUES ($1, $2, $3, $4)`,
    [courseId, title, content_url, order_index]
  );

  res.status(201).json({
    success: true,
    message: "Lesson added successfully",
  });
};


// ======================= Update Lesson =======================

export const updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title, content_url, order_index } = req.body;

    if (!title && !content_url && !order_index) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update",
      });
    }

    // Fetch lesson → course → instructor
    const lessonRes = await db.query(
      `SELECT c.instructor_id
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = $1`,
      [lessonId]
    );

    if (!lessonRes.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Ownership check (skip for admin)
    if (req.user.role !== "admin") {
      const instructorId = await getInstructorId(req.user.id);

      if (lessonRes.rows[0].instructor_id !== instructorId) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to update this lesson",
        });
      }
    }

    // Update lesson
    await db.query(
      `UPDATE lessons
       SET
         title = COALESCE($1, title),
         content_url = COALESCE($2, content_url),
         order_index = COALESCE($3, order_index),
         updated_at = NOW()
       WHERE id = $4`,
      [title, content_url, order_index, lessonId]
    );

    res.json({
      success: true,
      message: "Lesson updated successfully",
    });

  } catch (error) {
    console.error("UPDATE LESSON ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update lesson",
    });
  }
};


// ======================= Delete Lesson =======================

export const deleteLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;

    // Fetch lesson → course → instructor
    const lessonRes = await db.query(
      `SELECT c.instructor_id
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = $1`,
      [lessonId]
    );

    if (!lessonRes.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Ownership check (skip for admin)
    if (req.user.role !== "admin") {
      const instructorId = await getInstructorId(req.user.id);

      if (lessonRes.rows[0].instructor_id !== instructorId) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to delete this lesson",
        });
      }
    }

    await db.query("DELETE FROM lessons WHERE id = $1", [lessonId]);

    res.json({
      success: true,
      message: "Lesson deleted successfully",
    });

  } catch (error) {
    console.error("DELETE LESSON ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete lesson",
    });
  }
};



