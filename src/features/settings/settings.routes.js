import { Router } from "express";
import { getSettingsHandler, updateSettingsHandler } from "./settings.controller.js";

const router = Router();

router.get("/", getSettingsHandler);
router.put("/", updateSettingsHandler);
router.patch("/", updateSettingsHandler);

export default router;
