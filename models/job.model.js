import mongoose from "mongoose";

const JobSchema = new mongoose.Schema(
  {
    jobImg: {
      type: String,
      default: null,
    },
    jobTitle: {
      type: String,
      required: true,
    },
    technologies: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      required: true,
    },
    jobType: {
      type: String,
      required: true,
    },
    salary: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      required: true,
    },
    referralReward: {
      type: String,
      default: null,
    },
    skills: {
      type: [String],
      default: [],
    },
    experience: {
      type: [String],
      default: [],
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    qualifications: {
      type: [String],
      default: [],
    },
    company: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for time ago
JobSchema.virtual("time").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return "1 day ago";
  if (diffDays <= 7) return `${diffDays} days ago`;
  return `${Math.ceil(diffDays / 7)} weeks ago`;
});

JobSchema.set("toJSON", { virtuals: true });

const Job = mongoose.model("Job", JobSchema);

export default Job;
