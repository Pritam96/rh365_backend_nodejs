import express from "express";
import {
  loginAdmin,
  getMe,
  logout,
  createJob,
  getAllApplications,
  getApplication,
  updateApplicationStatus,
} from "../controllers/admin.controller.js";
import { protect } from "../middlewares/auth.js";
import { handleMulterError, jobImageUpload } from "../middlewares/multer.js";

const router = express.Router();

// Public routes
router.post("/login", loginAdmin);

// Protected routes
router.get("/me", protect, getMe);
router.get("/logout", protect, logout);

// Create Job Post
router.post(
  "/create",
  protect,
  jobImageUpload.single("jobImage"),
  handleMulterError,
  createJob
);

router.get("/application/", protect, getAllApplications);
router.get("/application/:id", protect, getApplication);
router.put("/application/:id/status", protect, updateApplicationStatus);

export default router;
