import { google } from "googleapis";
import { ENV } from "./env.js";

// Google Sheets client
let sheets = null;
if (ENV.GOOGLE_SERVICE_ACCOUNT_JSON_SHEETS) {
  try {
    const serviceAccountSheets = JSON.parse(ENV.GOOGLE_SERVICE_ACCOUNT_JSON_SHEETS);
    const authSheets = new google.auth.GoogleAuth({
      credentials: serviceAccountSheets,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheets = google.sheets({ version: "v4", auth: authSheets });
  } catch (err) {
    console.error("[ERROR] Failed to initialize Google Sheets client:", err.message);
  }
}

export { sheets };


