import db from "../db.js";


// ======================= Enroll Course =======================

export const enrollCourse = async (req, res) => {
  const { courseId } = req.params;

  await db.query(
    `INSERT INTO enrollments (student_id, course_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [req.user.id, courseId]
  );

  res.json({ success: true, message: "Enrolled successfully" });
};


// ======================= My Courses =======================

export const getMyCourses = async (req, res) => {
  const result = await db.query(
    `SELECT c.*
     FROM enrollments e
     JOIN courses c ON e.course_id = c.id
     WHERE e.student_id = $1`,
    [req.user.id]
  );

  res.json({ success: true, courses: result.rows });
};



