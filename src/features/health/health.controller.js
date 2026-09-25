import { sheets } from "../../config/google.js";
import { firebaseAdmin } from "../../config/firebase.js";
import { ENV } from "../../config/env.js";

export async function healthCheckHandler(req, res) {
  const startTime = Date.now();
  const deepCheck = req.query.deep === "true";

  const mem = process.memoryUsage();
  const formatMB = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "production",
    version: "1.8.0",
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rssMB: formatMB(mem.rss),
        heapTotalMB: formatMB(mem.heapTotal),
        heapUsedMB: formatMB(mem.heapUsed),
      },
    },
    services: {
      googleSheets: {
        status: sheets && ENV.SHEET_ID ? "ready" : "not_configured",
        configured: Boolean(sheets && ENV.SHEET_ID),
      },
      cloudinary: {
        status: Boolean(ENV.CLOUDINARY_CLOUD_NAME && ENV.CLOUDINARY_API_KEY)
          ? "ready"
          : "not_configured",
        configured: Boolean(ENV.CLOUDINARY_CLOUD_NAME && ENV.CLOUDINARY_API_KEY),
      },
      firebase: {
        status: firebaseAdmin ? "ready" : "not_configured",
        configured: Boolean(firebaseAdmin),
      },
    },
  };

  // Nếu client yêu cầu kiểm tra sâu (deep check) kết nối thực tế tới Google Sheets
  if (deepCheck && sheets && ENV.SHEET_ID) {
    try {
      const pingStart = Date.now();
      await sheets.spreadsheets.get({
        spreadsheetId: ENV.SHEET_ID,
        fields: "spreadsheetId",
      });
      healthData.services.googleSheets.ping = "ok";
      healthData.services.googleSheets.latencyMs = Date.now() - pingStart;
    } catch (err) {
      healthData.status = "degraded";
      healthData.services.googleSheets.ping = "failed";
      healthData.services.googleSheets.error =
        err.message || "Không thể kết nối Google Sheets";
    }
  }

  healthData.responseTimeMs = Date.now() - startTime;

  const httpStatus = healthData.status === "healthy" ? 200 : 207;
  return res.status(httpStatus).json(healthData);
}
