import fs from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

class JobPortalUploadService {
  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME;
    this.s3 = null;
    this.initializeS3();
  }

  initializeS3() {
    if (
      process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      this.bucketName
    ) {
      this.s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      console.log("✅ S3 client initialized successfully");
    } else {
      console.log("⚠️ S3 credentials not found - uploads will fail");
    }
  }

  // Upload resume/CV files
  async uploadResume(filePath, applicantName, jobId) {
    try {
      if (!this.s3) {
        throw new Error("S3 client not initialized");
      }

      const fileContent = fs.readFileSync(filePath);
      const fileExt = path.extname(filePath);
      const timestamp = Date.now();

      // Create unique filename: resumes/applicantName_jobId_timestamp.ext
      const fileName = `${applicantName.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${jobId}_${timestamp}${fileExt}`;
      const s3Key = `job-portal/resumes/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: this.getContentType(fileExt),
        Metadata: {
          type: "resume",
          applicantName: applicantName,
          jobId: jobId.toString(),
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3.send(command);

      // Clean up local file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      console.log(`✅ Resume uploaded: ${s3Key}`);

      return {
        success: true,
        url: this.getPublicUrl(s3Key),
        key: s3Key,
        fileName: fileName,
      };
    } catch (error) {
      // Clean up local file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      console.error("❌ Resume upload failed:", error.message);
      throw new Error(`Resume upload failed: ${error.message}`);
    }
  }

  // Upload job images
  async uploadJobImage(filePath, jobTitle) {
    try {
      if (!this.s3) {
        throw new Error("S3 client not initialized");
      }

      const fileContent = fs.readFileSync(filePath);
      const fileExt = path.extname(filePath);
      const timestamp = Date.now();

      // Create unique filename: job-images/jobTitle_timestamp.ext
      const fileName = `${jobTitle.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${timestamp}${fileExt}`;
      const s3Key = `job-portal/job-images/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: this.getContentType(fileExt),
        CacheControl: "max-age=31536000", // Cache for 1 year
        Metadata: {
          type: "job-image",
          jobTitle: jobTitle,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3.send(command);

      // Clean up local file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      console.log(`✅ Job image uploaded: ${s3Key}`);

      return {
        success: true,
        url: this.getPublicUrl(s3Key),
        key: s3Key,
        fileName: fileName,
      };
    } catch (error) {
      // Clean up local file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      console.error("❌ Job image upload failed:", error.message);
      throw new Error(`Job image upload failed: ${error.message}`);
    }
  }

  // Generate signed URL for downloading resumes (admin only)
  async getResumeDownloadUrl(s3Key, expiresInSeconds = 3600) {
    try {
      if (!this.s3) {
        throw new Error("S3 client not initialized");
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3, command, {
        expiresIn: expiresInSeconds,
      });

      return url;
    } catch (error) {
      console.error("❌ Failed to generate download URL:", error.message);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  // Delete file from S3
  async deleteFile(s3Key) {
    try {
      if (!this.s3) {
        throw new Error("S3 client not initialized");
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3.send(command);
      console.log(`✅ File deleted: ${s3Key}`);

      return { success: true };
    } catch (error) {
      console.error("❌ File deletion failed:", error.message);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  // Get content type based on file extension
  getContentType(fileExt) {
    const contentTypes = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".txt": "text/plain",
      ".rtf": "application/rtf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };

    return contentTypes[fileExt.toLowerCase()] || "application/octet-stream";
  }

  // Get public URL (for job images)
  getPublicUrl(s3Key) {
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
  }

  // Check if service is ready
  isReady() {
    return this.s3 !== null;
  }
}

// Export singleton instance
export const uploadService = new JobPortalUploadService();
