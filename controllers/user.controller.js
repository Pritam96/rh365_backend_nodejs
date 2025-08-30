import { uploadService } from "../services/uploadService.js";
import Application from "../models/application.model.js";
import Job from "../models/job.model.js";
import ErrorResponse from "../utils/errorResponse.js";

// @desc    Submit job application
// @route   POST /api/applications/apply
// @access  Public
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
      return next(
        new ErrorResponse(`Resume upload failed: ${uploadError.message}`, 500)
      );
    }

    // === CREATE APPLICATION ===
    const application = await Application.create({
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
    next(error);
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

// @desc    Get single job by ID
// @route   GET /api/jobs/:id
// @access  Public
export const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

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
