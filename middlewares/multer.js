import multer from "multer";
import path from "path";
import fs from "fs";

// Resume/CV specific MIME types (more restrictive for security)
const RESUME_MIME_TYPES = [
  "application/pdf", // PDF
  "application/msword", // DOC
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
  "text/plain", // TXT
  "application/rtf", // RTF
];

// Job posting image MIME types (for job descriptions, company logos, etc.)
const JOB_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// Ensure upload directories exist
const createUploadDirs = () => {
  const dirs = [
    "./public/uploads/resumes",
    "./public/uploads/job-images",
    "./public/temp",
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize directories
createUploadDirs();

// File filter for resume uploads
const resumeFileFilter = (req, file, cb) => {
  if (RESUME_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Please upload PDF, DOC, DOCX, TXT, or RTF files only."
      ),
      false
    );
  }
};

// File filter for job images
const jobImageFilter = (req, file, cb) => {
  if (JOB_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid image type. Please upload JPEG, JPG, PNG, or WebP images only."
      ),
      false
    );
  }
};

// Storage configuration for resumes
const resumeStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads/resumes");
  },
  filename: function (req, file, cb) {
    // Create unique filename: applicantName_jobId_timestamp.ext
    const timestamp = Date.now();
    const randomNum = Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    const jobId = req.body.jobId || "job";
    const applicantName = req.body.fullName
      ? req.body.fullName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
      : "applicant";

    const filename = `${applicantName}_${jobId}_${timestamp}_${randomNum}${ext}`;
    cb(null, filename);
  },
});

// Storage configuration for job images
const jobImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads/job-images");
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const randomNum = Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    const filename = `job_${timestamp}_${randomNum}${ext}`;
    cb(null, filename);
  },
});

// Temporary storage for processing
const tempStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// Resume upload configuration (for job applications)
export const resumeUpload = multer({
  storage: resumeStorage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for resumes
    files: 1, // Only one resume per application
  },
});

// Job image upload configuration (for admin job postings)
export const jobImageUpload = multer({
  storage: jobImageStorage,
  fileFilter: jobImageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
    files: 5, // Maximum 5 images per job posting
  },
});

// Multiple field upload for job applications (resume + optional cover letter)
export const jobApplicationUpload = multer({
  storage: resumeStorage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 2, // Resume + cover letter
  },
});

// Temporary upload for processing (legacy support)
export const tempUpload = multer({
  storage: tempStorage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Error handling middleware
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message:
          "File too large. Maximum size allowed is 10MB for resumes and 5MB for images.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum allowed files exceeded.",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected field name in file upload.",
      });
    }
  }

  // Handle file type errors
  if (err.message.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
};

// Helper function to clean up old files (call periodically)
export const cleanupOldFiles = (
  directory,
  maxAge = 7 * 24 * 60 * 60 * 1000
) => {
  // 7 days
  fs.readdir(directory, (err, files) => {
    if (err) return;

    files.forEach((file) => {
      const filePath = path.join(directory, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        const now = new Date().getTime();
        const fileTime = new Date(stats.ctime).getTime();

        if (now - fileTime > maxAge) {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Error deleting old file ${filePath}:`, err);
            else console.log(`Deleted old file: ${filePath}`);
          });
        }
      });
    });
  });
};

// Export default for backward compatibility
export default resumeUpload;
