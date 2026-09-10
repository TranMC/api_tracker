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

// Google Drive client
let drive = null;
if (ENV.GOOGLE_DRIVE_OAUTH_CREDENTIALS && ENV.GOOGLE_DRIVE_OAUTH_TOKEN) {
  try {
    const credentials = JSON.parse(ENV.GOOGLE_DRIVE_OAUTH_CREDENTIALS);
    const { client_id, client_secret, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    const token = JSON.parse(ENV.GOOGLE_DRIVE_OAUTH_TOKEN);
    oAuth2Client.setCredentials(token);
    drive = google.drive({ version: "v3", auth: oAuth2Client });
  } catch (err) {
    console.error("[ERROR] Failed to initialize Google Drive client:", err.message);
  }
}

export { sheets, drive };
