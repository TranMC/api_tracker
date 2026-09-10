import multer from "multer";
import os from "os";

export const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB max per file
    files: 20,                    // 20 files max per request
  },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
});
