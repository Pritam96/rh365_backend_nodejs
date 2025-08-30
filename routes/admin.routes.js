import express from "express";
import { createUser } from "../controllers/admin.controller.js";
import { authorize, protect } from "../middlewares/auth.js";

const router = express.Router();

// create new user
router.post("/user/create", protect, authorize("admin"), createUser);

export default router;
