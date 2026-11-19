
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const emergencyRoutes = require("./routes/emergencyRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Main server test
app.get("/", (req, res) => {
  res.send("LifeLane Backend is Running!");
});

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LifeLane API is working"
  });
});

// Emergency routes
app.use("/api/emergencies", emergencyRoutes);

// Start server after database connection
const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from the .env file");
    }

    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });

    console.log("MongoDB Connected Successfully");

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`LifeLane Server Running on Port ${PORT}`);
    });

  } catch (error) {
    console.error("\n========== MONGODB CONNECTION ERROR ==========");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code || "Not provided");

    if (error.cause) {
      console.error("Cause:", error.cause);
    }

    if (error.reason) {
      console.error("Server selection reason:", error.reason);
    }

    console.error("===============================================\n");

    process.exit(1);
  }
};

startServer();
