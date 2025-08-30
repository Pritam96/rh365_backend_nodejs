import mongoose from "mongoose";
import createAdmin from "../scripts/createAdmin.js";

const connectDb = async (dbName) => {
  try {
    const uri = await mongoose.connect(process.env.MONGO_URI, {
      dbName: dbName,
    });

    console.log(`🚀 MongoDB connected: ${uri.connection.host}`);

    // Create admin after successful DB connection
    console.log("🔧 Checking/Creating admin user...");
    await createAdmin();
  } catch (error) {
    console.log("❌ MongoDB connection error:", error.message);
    process.exit(1); // Exit process with failure
  }
};

export default connectDb;
