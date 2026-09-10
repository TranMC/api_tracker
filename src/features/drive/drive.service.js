import fs from "fs";
import { drive } from "../../config/google.js";
import { ENV } from "../../config/env.js";

export async function uploadFilesToDrive(files) {
  if (!drive) throw new Error("Google Drive client is not initialized");
  if (!files || files.length === 0) throw new Error("No files uploaded");

  const folderId = ENV.GOOGLE_DRIVE_FOLDER_ID || undefined;
  const links = [];

  for (const file of files) {
    try {
      const fileStream = fs.createReadStream(file.path);
      const driveRes = await drive.files.create({
        requestBody: {
          name: file.originalname,
          mimeType: file.mimetype,
          parents: folderId ? [folderId] : undefined,
        },
        media: {
          mimeType: file.mimetype,
          body: fileStream,
        },
        fields: "id,webViewLink,webContentLink",
      });

      // Set public read permission
      await drive.permissions.create({
        fileId: driveRes.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });

      // Get public view link
      const fileMeta = await drive.files.get({
        fileId: driveRes.data.id,
        fields: "id,webViewLink,webContentLink",
      });
      const fileId = fileMeta.data.id || driveRes.data.id;
      const previewLink = fileId
        ? `https://drive.google.com/uc?export=view&id=${fileId}`
        : fileMeta.data.webContentLink || fileMeta.data.webViewLink;

      links.push(previewLink);
    } finally {
      // Clean up temporary file from disk
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
    }
  }

  return links;
}
