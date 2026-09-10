import { Router } from "express";
import { uploadFilesHandler } from "./drive.controller.js";
import { uploadMiddleware } from "../../common/upload.middleware.js";

const router = Router();

router.post("/upload-drive", uploadMiddleware.array("files"), uploadFilesHandler);
router.post("/upload-cloudinary", uploadMiddleware.array("files"), uploadFilesHandler);


export default router;
