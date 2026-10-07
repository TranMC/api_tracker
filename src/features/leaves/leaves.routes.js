import { Router } from "express";
import {
  getLeavesHandler,
  createLeaveHandler,
  updateLeaveHandler,
  deleteLeaveHandler,
} from "./leaves.controller.js";

const router = Router();

router.get("/", getLeavesHandler);
router.post("/", createLeaveHandler);
router.patch("/:id", updateLeaveHandler);
router.delete("/:id", deleteLeaveHandler);

export default router;
