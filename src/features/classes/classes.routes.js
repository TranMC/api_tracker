import { Router } from "express";
import {
  getTodayClassesHandler,
  getAllClassesHandler,
  createClassHandler,
  updateClassHandler,
  deleteClassHandler,
  getClassStudentsHandler,
} from "./classes.controller.js";

const router = Router();

router.get("/today", getTodayClassesHandler);
router.get("/", getAllClassesHandler);
router.post("/", createClassHandler);
router.patch("/:id", updateClassHandler);
router.delete("/:id", deleteClassHandler);
router.get("/:classId/students", getClassStudentsHandler);

export default router;
