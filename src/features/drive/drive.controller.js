import {
  uploadFilesToCloudinary,
  deleteFilesFromCloudinary,
} from "../cloudinary/cloudinary.service.js";

export async function uploadFilesHandler(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const links = await uploadFilesToCloudinary(req.files);
    res.json({ links });
  } catch (err) {
    next(err);
  }
}

export async function deleteFilesHandler(req, res, next) {
  try {
    const { url, urls } = req.body || {};
    const targetUrls = urls || (url ? [url] : []);
    if (!targetUrls || targetUrls.length === 0) {
      return res.status(400).json({ error: "No image/file URL provided for deletion" });
    }

    const result = await deleteFilesFromCloudinary(targetUrls);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

