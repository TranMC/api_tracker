import { uploadFilesToCloudinary } from "../cloudinary/cloudinary.service.js";

// Tương thích ngược: chuyển tiếp toàn bộ sang Cloudinary service
export const uploadFilesToDrive = uploadFilesToCloudinary;
export default uploadFilesToCloudinary;
