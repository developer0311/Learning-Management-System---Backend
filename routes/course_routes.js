import express from "express";
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  togglePublishCourse,
  getInstructorCourses,
} from "../controllers/course_controllers.js";
import { protect, authorizeRoles } from "../middlewares/auth_middlewares.js";

const router = express.Router();

/* ===================== PUBLIC ===================== */

// Get all published courses
router.get("/", getAllCourses);

// Get published course by ID
router.get("/:courseId", getCourseById);

/* ===================== INSTRUCTOR / ADMIN ===================== */

// Create course
router.post(
  "/",
  protect,
  authorizeRoles("instructor", "admin"),
  createCourse
);

// Update course
router.put(
  "/:courseId",
  protect,
  authorizeRoles("instructor", "admin"),
  updateCourse
);

// Delete course
router.delete(
  "/:courseId",
  protect,
  authorizeRoles("instructor", "admin"),
  deleteCourse
);

// Toggle publish / unpublish
router.patch(
  "/:courseId/publish",
  protect,
  authorizeRoles("instructor", "admin"),
  togglePublishCourse
);

// Get instructor's own courses
router.get(
  "/instructor/me",
  protect,
  authorizeRoles("instructor", "admin"),
  getInstructorCourses
);

export default router;
