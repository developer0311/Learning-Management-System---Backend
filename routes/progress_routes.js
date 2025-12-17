import express from "express";
import {
  completeLesson,
  getCourseProgress,
} from "../controllers/progress_controllers.js";

import { protect, authorizeRoles } from "../middlewares/auth_middlewares.js";

const router = express.Router();

/* ===================== STUDENT ===================== */

// Mark lesson complete
router.post(
  "/lessons/:lessonId/complete",
  protect,
  authorizeRoles("student"),
  completeLesson
);

// Get course progress
router.get(
  "/courses/:courseId/progress",
  protect,
  authorizeRoles("student"),
  getCourseProgress
);

export default router;
