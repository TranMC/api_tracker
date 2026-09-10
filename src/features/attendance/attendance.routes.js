import { Router } from "express";
import {
  getDashboardStatsHandler,
  getAllAttendanceHandler,
  getAttendanceByClassAndDateHandler,
  updateAttendanceHandler,
  deleteAttendanceHandler,
  getAttendanceCriteriaHandler,
  createAttendanceCriteriaHandler,
  upsertAttendanceCriteriaHandler,
  updateAttendanceCriteriaByIndexHandler,
  deleteAttendanceCriteriaByIndexHandler,
} from "./attendance.controller.js";

const router = Router();

// Dashboard stats
router.get("/dashboard/stats", getDashboardStatsHandler);

// Attendance records
router.get("/attendance", getAllAttendanceHandler);
router.get("/attendance/:classId/:date", getAttendanceByClassAndDateHandler);
router.patch("/attendance/:attendanceId", updateAttendanceHandler);
router.delete("/attendance/:attendanceId", deleteAttendanceHandler);

// Attendance criteria
router.get("/attendance-criteria", getAttendanceCriteriaHandler);
router.post("/attendance-criteria", createAttendanceCriteriaHandler);
router.post("/attendance-criteria/upsert", upsertAttendanceCriteriaHandler);
router.patch("/attendance-criteria/:rowIndex", updateAttendanceCriteriaByIndexHandler);
router.delete("/attendance-criteria/:rowIndex", deleteAttendanceCriteriaByIndexHandler);

export default router;
