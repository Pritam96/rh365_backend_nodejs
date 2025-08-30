import Admin from "../models/admin.model.js";
import ErrorResponse from "../utils/errorResponse.js";

import { uploadService } from "../services/uploadService.js";
import Job from "../models/job.model.js";
import Application from "../models/application.model.js";

// @desc    Login admin
// @route   POST /api/admin/login
// @access  Public
export const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return next(
        new ErrorResponse("Please provide an email and password", 400)
      );
    }

    // Check for admin (include password since it's select: false)
    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin) {
      return next(new ErrorResponse("Invalid credentials", 401));
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return next(new ErrorResponse("Invalid credentials", 401));
    }

    sendTokenResponse(admin, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in admin
// @route   GET /api/admin/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout admin / clear cookie
// @route   GET /api/admin/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    res.cookie("token", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to get token from model, create cookie and send response
const sendTokenResponse = (admin, statusCode, res) => {
  // Create token
  const token = admin.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") {
    options.secure = true;
  }

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    token,
  });
};

export const createJob = async (req, res, next) => {
  try {
    let {
      jobTitle,
      technologies,
      location,
      jobType,
      salary,
      description,
      company,
      referralReward,
      skills,
      experience,
      responsibilities,
      qualifications,
    } = req.body;

    // === PARSE ARRAYS FROM FORM-DATA ===
    const parseArray = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (typeof field === "string") {
        try {
          // Try to parse as JSON first
          return JSON.parse(field);
        } catch (e) {
          // If JSON parsing fails, split by comma
          return field
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        }
      }
      return [];
    };

    // Parse all array fields
    technologies = parseArray(technologies);
    skills = parseArray(skills);
    experience = parseArray(experience);
    responsibilities = parseArray(responsibilities);
    qualifications = parseArray(qualifications);

    // === BASIC REQUIRED VALIDATIONS ===
    if (!jobTitle?.trim()) {
      return next(new ErrorResponse("Job title is required", 400));
    }
    if (!location?.trim()) {
      return next(new ErrorResponse("Location is required", 400));
    }
    if (!jobType?.trim()) {
      return next(new ErrorResponse("Job type is required", 400));
    }
    if (!description?.trim()) {
      return next(new ErrorResponse("Job description is required", 400));
    }
    if (!company?.trim()) {
      return next(new ErrorResponse("Company name is required", 400));
    }

    // === LENGTH VALIDATIONS ===
    if (jobTitle.length > 100) {
      return next(
        new ErrorResponse("Job title cannot exceed 100 characters", 400)
      );
    }
    if (description.length > 2000) {
      return next(
        new ErrorResponse("Job description cannot exceed 2000 characters", 400)
      );
    }

    // === JOB TYPE VALIDATION ===
    const validJobTypes = [
      "Full Time / Permanent",
      "Part Time",
      "Contract",
      "Freelance",
      "Internship",
      "Remote",
      "Hybrid",
    ];
    if (!validJobTypes.includes(jobType)) {
      return next(
        new ErrorResponse(
          `Invalid job type. Valid options: ${validJobTypes.join(", ")}`,
          400
        )
      );
    }

    // === ARRAY VALIDATIONS ===
    if (!Array.isArray(technologies)) {
      return next(new ErrorResponse("Technologies must be an array", 400));
    }
    if (!Array.isArray(skills)) {
      return next(new ErrorResponse("Skills must be an array", 400));
    }
    if (!Array.isArray(experience)) {
      return next(new ErrorResponse("Experience must be an array", 400));
    }
    if (!Array.isArray(responsibilities)) {
      return next(new ErrorResponse("Responsibilities must be an array", 400));
    }
    if (!Array.isArray(qualifications)) {
      return next(new ErrorResponse("Qualifications must be an array", 400));
    }

    // === FILE UPLOAD VALIDATION ===
    let jobImageUrl = null;
    if (req.file) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return next(
          new ErrorResponse("Only JPEG, PNG, and WebP images are allowed", 400)
        );
      }

      if (req.file.size > 5 * 1024 * 1024) {
        return next(new ErrorResponse("Image size cannot exceed 5MB", 400));
      }

      try {
        const uploadResult = await uploadService.uploadJobImage(
          req.file.path,
          jobTitle
        );
        jobImageUrl = uploadResult.url;
      } catch (uploadError) {
        return next(
          new ErrorResponse(`Image upload failed: ${uploadError.message}`, 500)
        );
      }
    }

    // === CREATE JOB ===
    const job = await Job.create({
      jobTitle: jobTitle.trim(),
      technologies,
      location: location.trim(),
      jobType,
      salary: salary?.trim() || null,
      description: description.trim(),
      company: company.trim(),
      referralReward: referralReward?.trim() || null,
      skills,
      experience,
      responsibilities,
      qualifications,
      jobImg: jobImageUrl,
    });

    res.status(201).json({
      success: true,
      message: "Job created successfully",
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

export const getResumeDownloadUrl = async (req, res, next) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const downloadUrl = await uploadService.getResumeDownloadUrl(
      application.resume
    );

    res.json({
      success: true,
      downloadUrl,
      expiresIn: "1 hour",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all applications (Admin only)
// @route   GET /api/applications
// @access  Private
export const getAllApplications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, jobId, status, search } = req.query;

    // Build filter
    let filter = {};

    if (jobId) {
      filter.jobId = jobId;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { keySkills: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Get applications with job details
    const applications = await Application.find(filter)
      .populate("jobId", "jobTitle company location jobType salary")
      .sort({ createdAt: -1 })
      .limit(limitNumber)
      .skip(skip);

    const totalApplications = await Application.countDocuments(filter);
    const totalPages = Math.ceil(totalApplications / limitNumber);

    res.status(200).json({
      success: true,
      count: applications.length,
      totalApplications,
      totalPages,
      currentPage: pageNumber,
      data: applications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single application with resume download URL
// @route   GET /api/applications/:id
// @access  Private
export const getApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id).populate(
      "jobId",
      "jobTitle company location jobType salary description"
    );

    if (!application) {
      return next(new ErrorResponse("Application not found", 404));
    }

    // Generate resume download URL
    const resumeDownloadUrl = await uploadService.getResumeDownloadUrl(
      application.resume
    );

    res.status(200).json({
      success: true,
      data: {
        ...application.toObject(),
        resumeDownloadUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update application status
// @route   PUT /api/applications/:id/status
// @access  Private
export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;

    const validStatuses = [
      "pending",
      "reviewing",
      "shortlisted",
      "rejected",
      "hired",
    ];
    if (!validStatuses.includes(status)) {
      return next(
        new ErrorResponse(
          `Invalid status. Valid options: ${validStatuses.join(", ")}`,
          400
        )
      );
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status, notes: notes || null },
      { new: true, runValidators: true }
    ).populate("jobId", "jobTitle company");

    if (!application) {
      return next(new ErrorResponse("Application not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};
