import https from "https";
import { google } from "googleapis";
import { ENV } from "./env.js";

// Tạo HTTPS Agent tái sử dụng socket TCP và giữ kết nối sống (Keep-Alive)
// Giúp giảm tải DNS lookup (EAI_AGAIN) và tăng tốc độ gọi Google APIs
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 25,
  maxFreeSockets: 10,
  timeout: 60000,
});

google.options({
  agent: httpsAgent,
});

// Google Sheets client
let sheets = null;
if (ENV.GOOGLE_SERVICE_ACCOUNT_JSON_SHEETS) {
  try {
    const serviceAccountSheets = JSON.parse(ENV.GOOGLE_SERVICE_ACCOUNT_JSON_SHEETS);
    const authSheets = new google.auth.GoogleAuth({
      credentials: serviceAccountSheets,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      clientOptions: {
        httpAgent: httpsAgent,
      },
    });
    sheets = google.sheets({ version: "v4", auth: authSheets });
  } catch (err) {
    console.error("[ERROR] Failed to initialize Google Sheets client:", err.message);
  }
}

export { sheets };


