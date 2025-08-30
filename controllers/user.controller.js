import { uploadService } from "../services/uploadService.js";
import Application from "../models/application.model.js";
import Job from "../models/job.model.js";
import ErrorResponse from "../utils/errorResponse.js";
import { cleanupFiles } from "../middlewares/multer.js";

export const submitApplication = async (req, res, next) => {
  try {
    const {
      jobId,
      firstName,
      lastName,
      email,
      phone,
      city,
      country,
      linkedIn,
      keySkills,
      about,
    } = req.body;

    // === BASIC VALIDATIONS ===
    if (!jobId) {
      return next(new ErrorResponse("Job ID is required", 400));
    }
    if (!firstName?.trim()) {
      return next(new ErrorResponse("First name is required", 400));
    }
    if (!lastName?.trim()) {
      return next(new ErrorResponse("Last name is required", 400));
    }
    if (!email?.trim()) {
      return next(new ErrorResponse("Email is required", 400));
    }
    if (!phone?.trim()) {
      return next(new ErrorResponse("Phone number is required", 400));
    }
    if (!city?.trim()) {
      return next(new ErrorResponse("City is required", 400));
    }
    if (!country?.trim()) {
      return next(new ErrorResponse("Country is required", 400));
    }
    if (!keySkills?.trim()) {
      return next(new ErrorResponse("Key skills are required", 400));
    }
    if (!about?.trim()) {
      return next(new ErrorResponse("About section is required", 400));
    }

    // === EMAIL VALIDATION ===
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(
        new ErrorResponse("Please provide a valid email address", 400)
      );
    }

    // === RESUME VALIDATION ===
    if (!req.file) {
      return next(new ErrorResponse("Resume file is required", 400));
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(
        new ErrorResponse(
          "Only PDF, DOC, DOCX, and TXT files are allowed for resume",
          400
        )
      );
    }

    if (req.file.size > 10 * 1024 * 1024) {
      return next(
        new ErrorResponse("Resume file size cannot exceed 10MB", 400)
      );
    }

    // === CHECK IF JOB EXISTS ===
    const job = await Job.findById(jobId);
    if (!job) {
      return next(new ErrorResponse("Job not found", 404));
    }

    if (!job.isActive) {
      return next(new ErrorResponse("This job is no longer active", 400));
    }

    // Check if job has expired
    if (job.expiryDate && job.expiryDate <= new Date()) {
      return next(new ErrorResponse("This job has expired", 400));
    }

    // Check if max applications reached
    if (job.maxApplications && job.applicationCount >= job.maxApplications) {
      return next(
        new ErrorResponse(
          "Maximum applications for this job have been reached",
          400
        )
      );
    }

    // === CHECK FOR DUPLICATE APPLICATION ===
    const existingApplication = await Application.findOne({
      jobId,
      email: email.toLowerCase(),
    });

    if (existingApplication) {
      return next(
        new ErrorResponse("You have already applied for this job", 400)
      );
    }

    // === UPLOAD RESUME ===
    let resumeKey;
    try {
      const uploadResult = await uploadService.uploadResume(
        req.file.path,
        `${firstName}_${lastName}`,
        jobId
      );
      resumeKey = uploadResult.key;
    } catch (uploadError) {
      await cleanupFiles(req.file.path, null); // delete local only (upload failed before S3 save)
      return next(
        new ErrorResponse(`Resume upload failed: ${uploadError.message}`, 500)
      );
    }

    // === CREATE APPLICATION ===
    let application;
    try {
      application = await Application.create({
        jobId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        city: city.trim(),
        country: country.trim(),
        linkedIn: linkedIn?.trim() || null,
        keySkills: keySkills.trim(),
        about: about.trim(),
        resume: resumeKey,
      });
    } catch (dbError) {
      await cleanupFiles(req.file.path, resumeKey); // delete both local + S3
      return next(new ErrorResponse("Application creation failed", 500));
    }

    // === UPDATE JOB APPLICATION COUNT ===
    await Job.findByIdAndUpdate(jobId, {
      $inc: { applicationCount: 1 },
    });

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: {
        applicationId: application._id,
        applicantName: `${firstName} ${lastName}`,
        jobTitle: job.jobTitle,
        company: job.company,
        appliedAt: application.createdAt,
      },
    });
  } catch (error) {
    await cleanupFiles(req.file.path, resumeKey); // delete both local + S3
    return next(new ErrorResponse("Application creation failed", 500));
  }
};

export const getAllJobs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      location,
      jobType,
      company,
    } = req.query;

    // Build filter object
    let filter = { isActive: true };

    // Search functionality
    if (search) {
      filter.$or = [
        { jobTitle: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }

    // Location filter
    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }

    // Job type filter
    if (jobType) {
      filter.jobType = jobType;
    }

    // Company filter
    if (company) {
      filter.company = { $regex: company, $options: "i" };
    }

    // Pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Execute query
    const jobs = await Job.find(filter)
      .populate("postedBy", "email role name")
      .sort({ createdAt: -1 })
      .limit(limitNumber)
      .skip(skip)
      .select("-__v");

    // Get total count for pagination
    const totalJobs = await Job.countDocuments(filter);
    const totalPages = Math.ceil(totalJobs / limitNumber);

    // Add time ago to each job
    const jobsWithTimeAgo = jobs.map((job) => {
      const jobObj = job.toObject();
      const now = new Date();
      const diffTime = Math.abs(now - job.createdAt);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        jobObj.timeAgo = "1 day ago";
      } else if (diffDays <= 7) {
        jobObj.timeAgo = `${diffDays} days ago`;
      } else {
        jobObj.timeAgo = `${Math.ceil(diffDays / 7)} weeks ago`;
      }

      return jobObj;
    });

    res.status(200).json({
      success: true,
      count: jobs.length,
      totalJobs,
      totalPages,
      currentPage: pageNumber,
      data: jobsWithTimeAgo,
    });
  } catch (error) {
    next(error);
  }
};

export const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      "postedBy",
      "email role name"
    );

    if (!job) {
      return next(new ErrorResponse("Job not found", 404));
    }

    if (!job.isActive) {
      return next(new ErrorResponse("Job not available", 404));
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

// ======================== Protected Controllers for authorized user only ========================================
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
      postedBy: req.user._id,
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
      .populate("jobId", "jobTitle company location jobType salary description")
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
      { status, notes: notes || null, managedBy: req.user._id },
      { new: true, runValidators: true }
    )
      .populate("jobId", "jobTitle company")
      .populate("managedBy", "email role name");

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
