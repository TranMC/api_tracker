import fs from "fs";
import { cloudinary } from "../../config/cloudinary.js";

export async function uploadFilesToCloudinary(files) {
  if (!files || files.length === 0) throw new Error("No files uploaded");

  const links = [];

  for (const file of files) {
    try {
      const isRaw = !file.mimetype?.startsWith("image/") && !file.mimetype?.startsWith("video/");
      const resourceType = isRaw ? "raw" : "auto";

      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: "student_tracker",
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
      });

      links.push(uploadResult.secure_url || uploadResult.url);
    } finally {
      // Dọn dẹp file tạm trên ổ đĩa
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
    }
  }

  return links;
}
