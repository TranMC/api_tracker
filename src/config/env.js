import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 3001,
  SHEET_ID: process.env.SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_JSON_SHEETS: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_SHEETS,
  GOOGLE_SERVICE_ACCOUNT_JSON_FIREBASE: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_FIREBASE,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://trackerstudent.netlify.app"
      ],
};

// Validate critical variables
if (!ENV.SHEET_ID) {
  console.warn("[WARN] SHEET_ID environment variable is not set!");
}
if (!ENV.GOOGLE_SERVICE_ACCOUNT_JSON_SHEETS) {
  console.warn("[WARN] GOOGLE_SERVICE_ACCOUNT_JSON_SHEETS environment variable is not set!");
}
