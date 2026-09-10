import { Router } from "express";
import {
  saveFCMTokenHandler,
  testMailHandler,
  testPushHandler,
} from "./notification.controller.js";


const router = Router();

router.post("/save-fcm-token", saveFCMTokenHandler);
router.get("/test-mail", testMailHandler);
router.all("/test-push", testPushHandler);


export default router;
