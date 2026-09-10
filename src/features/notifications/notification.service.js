import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
} from "../../common/sheets.dao.js";
import { sendMail } from "../../config/mailer.js";
import { firebaseAdmin } from "../../config/firebase.js";
import { sheets } from "../../config/google.js";
import { ENV } from "../../config/env.js";

export async function saveFCMToken(token, username) {
  // Đảm bảo tiêu đề cột B trên Sheet luôn là "token"
  try {
    const resHeaders = await sheets.spreadsheets.values.get({
      spreadsheetId: ENV.SHEET_ID,
      range: "FCMTokens!A1:C1",
    });
    const curHeaders = resHeaders.data.values?.[0] || [];
    if (curHeaders[1] !== "token") {
      await sheets.spreadsheets.values.update({
        spreadsheetId: ENV.SHEET_ID,
        range: "FCMTokens!B1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["token"]] },
      });
    }
  } catch (e) {
    console.warn("[FCM] Auto-fix B1 header error:", e.message);
  }

  const tokens = await getSheetData("FCMTokens");
  const rowIndex = tokens.findIndex(row => row.username === username);

  if (rowIndex !== -1) {
    const rowValues = [username, token, new Date().toISOString()];
    await updateSheetRow("FCMTokens", rowIndex, rowValues);
    return { updated: true };
  }

  const rowValues = [username, token, new Date().toISOString()];
  await appendSheetRows("FCMTokens", [rowValues]);
  return { created: true };
}



export async function testMailService() {
  const accounts = await getSheetData("accounts");
  const teacher = accounts.find(acc => acc.email);
  if (!teacher || !teacher.email) {
    throw new Error("Không tìm thấy email giáo viên trong sheet accounts");
  }

  await sendMail({
    to: teacher.email,
    subject: "Test email",
    text: "Đây là email test từ hệ thống Student Tracker.",
    html: "<b>Đây là email test từ hệ thống Student Tracker.</b>",
  });

  return teacher.email;
}

export async function sendTestPushNotification(customToken = null) {
  if (!firebaseAdmin) {
    throw new Error("Firebase Admin chưa được khởi tạo! Vui lòng kiểm tra GOOGLE_SERVICE_ACCOUNT_JSON_FIREBASE trong .env");
  }

  let tokens = [];
  if (customToken) {
    tokens = [customToken];
  } else {
    const fcmRows = await getSheetData("FCMTokens");
    tokens = fcmRows.map(r => r.token).filter(Boolean);
  }

  if (tokens.length === 0) {
    throw new Error("Không tìm thấy token FCM nào trong Google Sheet tab FCMTokens để gửi test!");
  }

  const message = {
    notification: {
      title: "🔔 Test Thông Báo Đẩy",
      body: "Chúc mừng! Hệ thống Firebase Cloud Messaging (FCM) đã hoạt động thành công.",
    },
    tokens,
    webpush: {
      fcmOptions: {
        link: "https://trackerstudent.netlify.app",
      },
    },
  };

  const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    responses: response.responses,
  };
}
