import { Router } from "express";
import {
  getScoresHandler,
  createScoreHandler,
  updateScoreByIndexHandler,
  deleteScoreByIndexHandler,
} from "./scores.controller.js";

const router = Router();

router.get("/", getScoresHandler);
router.post("/", createScoreHandler);
router.patch("/:rowIndex", updateScoreByIndexHandler);
router.delete("/:rowIndex", deleteScoreByIndexHandler);

export default router;
