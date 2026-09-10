import express from "express";
import cors from "cors";
import { ENV } from "./config/env.js";
import apiRouter from "./routes.js";
import { errorHandler } from "./common/error.middleware.js";

const app = express();

// CORS setup
app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép request không có origin (ví dụ mobile app hoặc curl/postman)
      if (!origin) return callback(null, true);
      if (ENV.CORS_ORIGINS.includes(origin) || ENV.CORS_ORIGINS.includes("*")) {
        return callback(null, true);
      }
      return callback(null, true); // Trong môi trường production server node tự lưu trữ, hỗ trợ linh hoạt
    },
    credentials: true,
  })
);

app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Student Tracker API running!");
});

// Mount all API routes under /api
app.use("/api", apiRouter);

// Centralized error handler
app.use(errorHandler);

export default app;
