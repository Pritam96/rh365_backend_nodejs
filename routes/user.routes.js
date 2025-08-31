import express from "express";

import { resumeUpload } from "../middlewares/multer.js";
import {
  createJob,
  deleteJob,
  getAllApplications,
  getAllJobs,
  getApplication,
  getJobById,
  submitApplication,
  updateApplicationStatus,
  updateJob,
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.js";
import { handleMulterError, jobImageUpload } from "../middlewares/multer.js";

const router = express.Router();

// public routes ====================
router.post(
  "/jobs/:id/apply",
  resumeUpload.single("resume"),
  submitApplication
);
router.get("/jobs", getAllJobs);
router.get("/jobs/:id", getJobById);

// protected routes ==================

// job post management
router.post(
  "/jobs/create",
  protect,
  jobImageUpload.single("jobImage"),
  handleMulterError,
  createJob
);
router.put(
  "/jobs/:id/update",
  protect,
  jobImageUpload.single("jobImage"),
  handleMulterError,
  updateJob
);

router.delete("/jobs/:id/delete", protect, deleteJob);

// application management
router.get("/applications/", protect, getAllApplications);
router.get("/applications/:id", protect, getApplication);
router.put("/applications/:id/status", protect, updateApplicationStatus);

export default router;
