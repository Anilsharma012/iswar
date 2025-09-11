import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function connect() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log("URI:", process.env.MONGO_URI ? "SET" : "NOT SET");

    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "mannat",
      serverSelectionTimeoutMS: 8000,
    });
    console.log("✅ MongoDB OK");
  } catch (e) {
    console.error("❌ MongoDB FAIL:", e.name, e.code, e.message);
    console.warn("⚠️  Server will continue without database connection");
  }
}

export default connect;
