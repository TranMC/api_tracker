import { Router } from "express";
import { uploadFilesHandler, deleteFilesHandler } from "./drive.controller.js";
import { uploadMiddleware } from "../../common/upload.middleware.js";

const router = Router();

// Endpoint upload chuẩn & Cloudinary
router.post("/upload", uploadMiddleware.array("files"), uploadFilesHandler);
router.post("/upload-cloudinary", uploadMiddleware.array("files"), uploadFilesHandler);

// Endpoint xóa file trên Cloudinary vĩnh viễn
router.post("/upload/delete", deleteFilesHandler);
router.delete("/upload", deleteFilesHandler);

// Giữ lại /upload-drive để tương thích ngược 100%
router.post("/upload-drive", uploadMiddleware.array("files"), uploadFilesHandler);

export default router;
