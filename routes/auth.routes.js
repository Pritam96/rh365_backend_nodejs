import express from "express";
import { loginUser, getMe, logout } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

// Public routes
router.post("/login", loginUser);

// Protected routes
router.get("/me", protect, getMe);
router.get("/logout", protect, logout);

export default router;
