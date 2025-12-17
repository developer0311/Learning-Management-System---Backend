import express from "express";
import {
  addLesson,
  updateLesson,
  deleteLesson,
} from "../controllers/lesson_controllers.js";

import { protect, authorizeRoles } from "../middlewares/auth_middlewares.js";

const router = express.Router();

/* ===================== INSTRUCTOR / ADMIN ===================== */

// Add lesson to a course
router.post(
  "/courses/:courseId",
  protect,
  authorizeRoles("instructor", "admin"),
  addLesson
);

// Update lesson
router.put(
  "/:lessonId",
  protect,
  authorizeRoles("instructor", "admin"),
  updateLesson
);

// Delete lesson
router.delete(
  "/:lessonId",
  protect,
  authorizeRoles("instructor", "admin"),
  deleteLesson
);

export default router;
