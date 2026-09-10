import { Router } from "express";
import { saveFCMTokenHandler, testMailHandler } from "./notification.controller.js";

const router = Router();

router.post("/save-fcm-token", saveFCMTokenHandler);
router.get("/test-mail", testMailHandler);

export default router;
