import db from "../db.js";

// ======================= Mark Lesson Complete =======================

export const completeLesson = async (req, res) => {
  const { lessonId } = req.params;

  await db.query(
    `INSERT INTO progress_tracking (lesson_id, enrollment_id, completed)
     VALUES ($1,
       (SELECT id FROM enrollments WHERE student_id=$2 LIMIT 1),
       true)
     ON CONFLICT DO NOTHING`,
    [lessonId, req.user.id]
  );

  res.json({ success: true, message: "Lesson marked complete" });
};


// ======================= Get Course Progress =======================

export const getCourseProgress = async (req, res) => {
  const { courseId } = req.params;

  const total = await db.query(
    "SELECT COUNT(*) FROM lessons WHERE course_id=$1",
    [courseId]
  );

  const completed = await db.query(
    `SELECT COUNT(*) FROM progress_tracking pt
     JOIN lessons l ON pt.lesson_id=l.id
     WHERE l.course_id=$1 AND pt.completed=true`,
    [courseId]
  );

  const progress = total.rows[0].count == 0
    ? 0
    : (completed.rows[0].count / total.rows[0].count) * 100;

  res.json({ success: true, progress });
};