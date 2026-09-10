import { Router } from "express";
import {
  getAllStudentsHandler,
  createStudentHandler,
  updateStudentHandler,
  removeStudentFromClassHandler,
  deleteStudentHandler,
} from "./students.controller.js";

const router = Router();

router.get("/", getAllStudentsHandler);
router.post("/", createStudentHandler);
router.patch("/:studentId", updateStudentHandler);
router.delete("/:studentId/classes/:classId", removeStudentFromClassHandler);
router.delete("/:studentId", deleteStudentHandler);

export default router;
