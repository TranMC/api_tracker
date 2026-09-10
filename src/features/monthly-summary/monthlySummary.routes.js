import { Router } from "express";
import {
  getMonthlySummaryHandler,
  createMonthlySummaryHandler,
  updateMonthlySummaryByIndexHandler,
  deleteMonthlySummaryByIndexHandler,
  getMonthlySummaryLiveHandler,
  materializeMonthlySummaryHandler,
} from "./monthlySummary.controller.js";

const router = Router();

router.get("/live", getMonthlySummaryLiveHandler);
router.post("/materialize", materializeMonthlySummaryHandler);
router.get("/", getMonthlySummaryHandler);
router.post("/", createMonthlySummaryHandler);
router.patch("/:rowIndex", updateMonthlySummaryByIndexHandler);
router.delete("/:rowIndex", deleteMonthlySummaryByIndexHandler);

export default router;
