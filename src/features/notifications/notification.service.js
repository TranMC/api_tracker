import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
} from "../../common/sheets.dao.js";
import { sendMail } from "../../config/mailer.js";

export async function saveFCMToken(token, username) {
  const tokens = await getSheetData("FCMTokens");
  const rowIndex = tokens.findIndex(row => row.username === username);

  if (rowIndex !== -1) {
    const headers = await getSheetHeaders("FCMTokens", ["username", "token", "timestamp"]);
    const updated = {
      ...tokens[rowIndex],
      token,
      timestamp: new Date().toISOString(),
    };
    const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
    await updateSheetRow("FCMTokens", rowIndex, rowValues);
    return { updated: true };
  }

  await appendSheetRows("FCMTokens", [
    [[username, token, new Date().toISOString()]],
  ]);
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
