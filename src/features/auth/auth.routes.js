import { Router } from "express";
import { loginHandler, updateUserHandler } from "./auth.controller.js";

const router = Router();

router.post("/login", loginHandler);
router.post("/users/update", updateUserHandler);

export default router;
