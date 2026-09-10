import { Router } from "express";
import {
  loginHandler,
  updateUserHandler,
  getUserProfileHandler,
  getAllAccountsHandler,
  createAccountHandler,
  updateAccountHandler,
  deleteAccountHandler,
} from "./auth.controller.js";

const router = Router();

router.post("/login", loginHandler);
router.get("/user-profile", getUserProfileHandler);
router.post("/users/update", updateUserHandler);

// CRUD Quản lý tài khoản
router.get("/users", getAllAccountsHandler);
router.post("/users", createAccountHandler);
router.put("/users/:username", updateAccountHandler);
router.delete("/users/:username", deleteAccountHandler);

export default router;
