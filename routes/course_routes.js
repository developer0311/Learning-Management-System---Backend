import express from "express";
import {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} from "../controllers/course_controllers.js";
import { protect, authorizeRoles } from "../middlewares/auth_middlewares.js";

const router = express.Router();



/* ===================== PUBLIC ===================== */

// Get all courses
router.get("/", getAllCourses);

// Get course by ID
router.get("/:courseId", getCourseById);

/* ===================== INSTRUCTOR / ADMIN ===================== */

// Create course
router.post("/", protect, authorizeRoles("instructor", "admin"), createCourse);

// Update course (owner or admin)
router.put(
  "/:courseId",
  protect,
  authorizeRoles("instructor", "admin"),
  updateCourse
);

// Delete course (owner or admin)
router.delete(
  "/:courseId",
  protect,
  authorizeRoles("instructor", "admin"),
  deleteCourse
);

export default router;
