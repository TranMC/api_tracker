import fs from "fs";
import { cloudinary } from "../../config/cloudinary.js";

export async function uploadFilesToCloudinary(files) {
  if (!files || files.length === 0) throw new Error("No files uploaded");

  const links = [];

  for (const file of files) {
    try {
      const isRaw = !file.mimetype?.startsWith("image/") && !file.mimetype?.startsWith("video/");
      const resourceType = isRaw ? "raw" : "auto";

      // Nếu file lớn hơn 20MB, dùng upload_large để upload theo khối (chunked) an toàn
      const isLargeFile = file.size && file.size > 20 * 1024 * 1024;
      const uploadFn = isLargeFile
        ? cloudinary.uploader.upload_large
        : cloudinary.uploader.upload;

      const uploadResult = await uploadFn(file.path, {
        folder: "student_tracker",
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        chunk_size: 6000000, // 6MB chunk cho large uploads
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

/**
 * Trích xuất public_id từ URL Cloudinary
 * Ví dụ: https://res.cloudinary.com/demo/image/upload/v1234/student_tracker/file.jpg -> student_tracker/file
 */
export function extractPublicIdFromCloudinaryUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let pathAfterUpload = url.substring(uploadIndex + "/upload/".length);
    // Loại bỏ version dạng v123456789/
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, "");

    // Loại bỏ query params
    pathAfterUpload = pathAfterUpload.split("?")[0];

    // Loại bỏ đuôi extension cuối cùng
    const lastDotIndex = pathAfterUpload.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      return pathAfterUpload.substring(0, lastDotIndex);
    }
    return pathAfterUpload;
  } catch (err) {
    console.warn("[Cloudinary] Failed to extract public_id:", err);
    return null;
  }
}

/**
 * Xóa một hoặc nhiều file trên Cloudinary vĩnh viễn
 */
export async function deleteFilesFromCloudinary(urls = []) {
  const targetList = Array.isArray(urls) ? urls : [urls];
  if (targetList.length === 0) return { deleted: [], errors: [] };

  const deleted = [];
  const errors = [];

  for (const url of targetList) {
    const publicId = extractPublicIdFromCloudinaryUrl(url);
    if (!publicId) continue;

    try {
      // 1. Thử xóa theo resource_type: image
      let res = await cloudinary.uploader.destroy(publicId, { invalidate: true });
      if (res && res.result === "ok") {
        deleted.push(url);
        continue;
      }

      // 2. Thử xóa theo resource_type: raw (tài liệu pdf, zip...)
      res = await cloudinary.uploader.destroy(publicId, { resource_type: "raw", invalidate: true });
      if (res && res.result === "ok") {
        deleted.push(url);
        continue;
      }

      // 3. Thử xóa theo resource_type: video
      res = await cloudinary.uploader.destroy(publicId, { resource_type: "video", invalidate: true });
      if (res && res.result === "ok") {
        deleted.push(url);
        continue;
      }

      // Nếu Cloudinary trả về "not found" tức file đã không còn
      deleted.push(url);
    } catch (err) {
      console.error(`[Cloudinary] Delete failed for ${publicId}:`, err);
      errors.push({ url, error: err.message });
    }
  }

  return { deleted, errors };
}
