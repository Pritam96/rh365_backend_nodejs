import express from "express";

import { resumeUpload } from "../middlewares/multer.js";
import {
  getAllJobs,
  getJobById,
  submitApplication,
} from "../controllers/user.controller.js";

const router = express.Router();

router.post("/apply", resumeUpload.single("resume"), submitApplication);

router.get("/", getAllJobs);
router.get("/:id", getJobById);

export default router;
