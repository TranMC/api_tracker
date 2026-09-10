import { Router } from "express";
import { loginHandler, updateUserHandler, getUserProfileHandler } from "./auth.controller.js";

const router = Router();

router.post("/login", loginHandler);
router.get("/user-profile", getUserProfileHandler);
router.post("/users/update", updateUserHandler);

export default router;
