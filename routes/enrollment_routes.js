import express from "express";
import {
  enrollCourse,
  getMyCourses,
} from "../controllers/enrollment_controllers.js";

import { protect, authorizeRoles } from "../middlewares/auth_middlewares.js";

const router = express.Router();

/* ===================== STUDENT ===================== */

// Enroll in course
router.post(
  "/courses/:courseId/enroll",
  protect,
  authorizeRoles("student"),
  enrollCourse
);

// Get my enrolled courses
router.get(
  "/my-courses",
  protect,
  authorizeRoles("student"),
  getMyCourses
);

export default router;
