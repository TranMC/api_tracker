import { Router } from "express";
import {
  getCheckinTimeSlotsHandler,
  createCheckinLogHandler,
  getCheckinLogsHandler,
} from "./checkin.controller.js";

const router = Router();

router.get("/checkin-time", getCheckinTimeSlotsHandler);
router.post("/checkin-log", createCheckinLogHandler);
router.get("/checkin-log", getCheckinLogsHandler);

export default router;
