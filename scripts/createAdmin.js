import Admin from "../models/admin.model.js";

const createAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: "admin@jobportal.com" });

    if (existingAdmin) {
      console.log("✅ Admin already exists!");
      return; // Don't exit process, just return
    }

    // Create admin
    const admin = await Admin.create({
      name: "Job Portal Admin",
      email: "admin@jobportal.com",
      password: "admin123", // Change this to a secure password
    });

    console.log("🎉 Admin created successfully!");
    console.log("📧 Email: admin@jobportal.com");
    console.log("🔑 Password: admin123");
    console.log("⚠️  Please change the password after first login!");
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
    // Don't exit process, just log the error
  }
};

export default createAdmin;
