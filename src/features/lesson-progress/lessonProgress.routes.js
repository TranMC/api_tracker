import { Router } from "express";
import {
  getLessonProgressHandler,
  createLessonProgressHandler,
  updateLessonProgressByIndexHandler,
  deleteLessonProgressByIndexHandler,
} from "./lessonProgress.controller.js";

const router = Router();

router.get("/", getLessonProgressHandler);
router.post("/", createLessonProgressHandler);
router.patch("/:rowIndex", updateLessonProgressByIndexHandler);
router.delete("/:rowIndex", deleteLessonProgressByIndexHandler);

export default router;
