import db from "../db.js";
import { getInstructorId } from "../middlewares/auth_middlewares.js";


// ======================= Get All Courses (Public) =======================

export const getAllCourses = async (req, res) => {
  try {
    let limit = req.query.limit || 10;

    let query = `
      SELECT
        c.id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.duration,
        c.total_lessons,
        c.total_assignments,
        c.price,
        c.discount_percent,
        c.rating,
        c.banner_url,
        c.created_at,
        u.id AS instructor_id,
        u.name AS instructor_name
      FROM courses c
      JOIN instructors i ON c.instructor_id = i.id
      JOIN users u ON i.user_id = u.id
      WHERE c.published = true
      ORDER BY c.created_at DESC
    `;

    const values = [];

    if (limit) {
      query += ` LIMIT $1`;
      values.push(Number(limit));
    }

    const result = await db.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Courses fetched",
      count: result.rows.length,
      courses: result.rows,
    });
  } catch (error) {
    console.error("GET ALL COURSES ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch courses",
    });
  }
};


// ======================= Get Course by ID (Public) =======================

export const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;

    // ---------- Course basic info ----------
    const courseResult = await db.query(
      `
      SELECT
        c.id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.duration,
        c.total_lessons,
        c.total_assignments,
        c.price,
        c.discount_percent,
        c.actual_price,
        c.rating,
        c.banner_url,
        c.created_at,

        u.id AS instructor_id,
        u.name AS instructor_name

      FROM courses c
      JOIN instructors i ON c.instructor_id = i.id
      JOIN users u ON i.user_id = u.id
      WHERE c.id = $1
        AND c.published = true
      `,
      [courseId],
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "COURSE_NOT_FOUND",
        message: "Course not found or not published",
      });
    }

    const course = courseResult.rows[0];

    // ---------- Course details ----------
    const detailsResult = await db.query(
      `
      SELECT
        overview,
        prerequisites,
        learning_outcomes,
        target_audience,
        syllabus
      FROM course_details
      WHERE course_id = $1
      `,
      [courseId],
    );

    // ---------- Modules + lessons ----------
    const modulesResult = await db.query(
      `
      SELECT
        m.id AS module_id,
        m.title AS module_title,
        m.order_index AS module_order,

        l.id AS lesson_id,
        l.title AS lesson_title,
        l.content_url,
        l.content_type,
        l.order_index AS lesson_order,
        l.is_preview,
        l.duration_minutes

      FROM course_modules m
      LEFT JOIN lessons l ON l.module_id = m.id
      WHERE m.course_id = $1
      ORDER BY m.order_index, l.order_index
      `,
      [courseId],
    );

    // ---------- Assignments ----------
    const assignmentsResult = await db.query(
      `
      SELECT
        id,
        title,
        description,
        due_date,
        created_at
      FROM assignments
      WHERE course_id = $1
      ORDER BY created_at
      `,
      [courseId],
    );

    // ---------- Transform modules ----------
    const modulesMap = {};

    for (const row of modulesResult.rows) {
      if (!modulesMap[row.module_id]) {
        modulesMap[row.module_id] = {
          id: row.module_id,
          title: row.module_title,
          order_index: row.module_order,
          lessons: [],
        };
      }

      if (row.lesson_id) {
        modulesMap[row.module_id].lessons.push({
          id: row.lesson_id,
          title: row.lesson_title,
          content_url: row.content_url,
          content_type: row.content_type,
          order_index: row.lesson_order,
          is_preview: row.is_preview,
          duration_minutes: row.duration_minutes,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Fetched Course Details",
      course,
      details: detailsResult.rows[0] || null,
      modules: Object.values(modulesMap),
      assignments: assignmentsResult.rows,
    });
  } catch (error) {
    console.error("GET COURSE BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch course details",
    });
  }
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
        error: "VALIDATION_ERROR",
        message: "Title, level and price are required",
      });
    }

    let instructorId;

    if (req.user.role === "instructor") {
      instructorId = await getInstructorId(req.user.id);

      if (!instructorId) {
        return res.status(403).json({
          success: false,
          error: "INSTRUCTOR_PROFILE_MISSING",
          message: "Instructor profile not found",
        });
      }
    }

    if (req.user.role === "admin") {
      instructorId = req.body.instructor_id;
      if (!instructorId) {
        return res.status(400).json({
          success: false,
          error: "INSTRUCTOR_ID_REQUIRED",
          message: "Instructor ID required",
        });
      }
    }

    const result = await db.query(
      `
      INSERT INTO courses
      (title, description, category, level, duration, price, discount_percent, banner_url, instructor_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
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
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Course created as draft",
      course: result.rows[0],
    });
  } catch (error) {
    console.error("CREATE COURSE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to create course",
    });
  }
};


// ======================= Update Course (Instructor Owner / Admin) =======================

export const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const courseRes = await db.query(
      "SELECT instructor_id FROM courses WHERE id = $1",
      [courseId],
    );

    if (!courseRes.rows.length) {
      return res.status(404).json({
        success: false,
        error: "COURSE_NOT_FOUND",
        message: "Course not found",
      });
    }

    if (req.user.role !== "admin") {
      const instructorId = await getInstructorId(req.user.id);
      if (courseRes.rows[0].instructor_id !== instructorId) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "You are not allowed to update this course",
        });
      }
    }

    await db.query(
      `
      UPDATE courses
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        level = COALESCE($4, level),
        duration = COALESCE($5, duration),
        price = COALESCE($6, price),
        discount_percent = COALESCE($7, discount_percent),
        banner_url = COALESCE($8, banner_url)
      WHERE id = $9
      `,
      [
        req.body.title,
        req.body.description,
        req.body.category,
        req.body.level,
        req.body.duration,
        req.body.price,
        req.body.discount_percent,
        req.body.banner_url,
        courseId,
      ],
    );

    return res.json({
      success: true,
      message: "Course updated successfully",
    });
  } catch (error) {
    console.error("UPDATE COURSE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
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
      [courseId],
    );

    if (!courseRes.rows.length) {
      return res.status(404).json({
        success: false,
        error: "COURSE_NOT_FOUND",
        message: "Course not found",
      });
    }

    if (req.user.role !== "admin") {
      const instructorId = await getInstructorId(req.user.id);
      if (courseRes.rows[0].instructor_id !== instructorId) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "You are not allowed to delete this course",
        });
      }
    }

    await db.query("DELETE FROM courses WHERE id = $1", [courseId]);

    return res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("DELETE COURSE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to delete course",
    });
  }
};


// ======================= Publish / Unpublish Course =======================

export const togglePublishCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // ---------- Fetch course ----------
    const courseRes = await db.query(
      "SELECT instructor_id, published FROM courses WHERE id = $1",
      [courseId],
    );

    if (!courseRes.rows.length) {
      return res.status(404).json({
        success: false,
        error: "COURSE_NOT_FOUND",
        message: "Course not found",
      });
    }

    const course = courseRes.rows[0];

    // ---------- Ownership check ----------
    if (req.user.role !== "admin") {
      const instructorId = await getInstructorId(req.user.id);

      if (course.instructor_id !== instructorId) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "You are not allowed to change publish status",
        });
      }
    }

    // ---------- Toggle ----------
    const newStatus = !course.published;

    const updateRes = await db.query(
      `
      UPDATE courses
      SET published = $1
      WHERE id = $2
      RETURNING id, published
      `,
      [newStatus, courseId],
    );

    return res.status(200).json({
      success: true,
      message: newStatus
        ? "Course published successfully"
        : "Course unpublished successfully",
      published: updateRes.rows[0].published,
    });
  } catch (error) {
    console.error("TOGGLE PUBLISH COURSE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to update publish status",
    });
  }
};


// ======================= Get My Courses =======================

export const getInstructorCourses = async (req, res) => {
  try {
    const instructorId = await getInstructorId(req.user.id);

    const result = await db.query(
      `
      SELECT *
      FROM courses
      WHERE instructor_id = $1
      ORDER BY created_at DESC
      `,
      [instructorId],
    );

    res.json({
      success: true,
      courses: result.rows,
    });
  } catch (error) {
    console.error("GET INSTRUCTOR COURSES ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
    });
  }
};
