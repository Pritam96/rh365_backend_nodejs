import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema(
  {
    // Job reference
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    // Personal Information
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // Location
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },

    // Professional Information
    linkedIn: {
      type: String,
      default: null,
      trim: true,
    },
    keySkills: {
      type: String,
      required: true,
    },
    about: {
      type: String,
      required: true,
    },

    // Resume/CV
    resume: {
      type: String, // File path
      required: true,
    },

    // Application Status
    status: {
      type: String,
      enum: ["pending", "reviewing", "shortlisted", "rejected", "hired"],
      default: "pending",
    },

    // HR Notes
    notes: {
      type: String,
      default: null,
    },

    // HR who updated status
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for full name
ApplicationSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Index for faster queries
ApplicationSchema.index({ jobId: 1, email: 1 });
ApplicationSchema.index({ status: 1 });

ApplicationSchema.set("toJSON", { virtuals: true });

const Application = mongoose.model("Application", ApplicationSchema);

export default Application;
