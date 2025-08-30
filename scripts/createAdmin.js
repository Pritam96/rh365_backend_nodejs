import User from "../models/user.model.js";
import dotenv from "dotenv";

dotenv.config({ path: "./config/config.env" });

const createAdmin = async () => {
  try {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME) {
      console.log("Configuration error");
      return;
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@jobportal.com" });

    if (existingAdmin) {
      console.log("✅ Admin already exists!");
      return;
    }

    // Create admin
    const admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: "admin",
      password: ADMIN_PASSWORD,
    });

    console.log(`🎉 Admin created successfully!`);
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
  }
};

export default createAdmin;
