import { uploadFilesToDrive } from "./drive.service.js";

export async function uploadFilesHandler(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const links = await uploadFilesToDrive(req.files);
    res.json({ links });
  } catch (err) {
    next(err);
  }
}
