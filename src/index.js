import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { router } from "./routes/routes.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI;
const NODE_ENV = process.env.NODE_ENV || "development";

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

// Security
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL?.split(",").map((url) => url.trim()) || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Rate limiter
const apiLimiter = rateLimit({
  windowMs: 1000,
  limit: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  skipFailedRequests: true,
});

app.use("/api", apiLimiter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    environment: NODE_ENV,
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api", router);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);

  res.status(err.statusCode || 500).json({
    success: false,
    message:
      NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Something went wrong",
  });
});

// MongoDB + Server
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

connectDB();