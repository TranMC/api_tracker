import { sheets } from "../config/google.js";
import { ENV } from "../config/env.js";

/**
 * Lấy toàn bộ dữ liệu của một Sheet dưới dạng mảng các Object (key là tên cột ở dòng 1)
 */
export async function getSheetData(sheetName) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ENV.SHEET_ID,
    range: sheetName,
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => (h ? h.trim() : ""));
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] !== undefined ? row[i] : "";
    });
    return obj;
  });
}

/**
 * Lấy danh sách tên các cột (Headers) của một Sheet
 */
export async function getSheetHeaders(sheetName, defaultHeaders = []) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ENV.SHEET_ID,
    range: sheetName,
  });
  if (res.data.values && res.data.values.length > 0) {
    return res.data.values[0].map(h => (h ? h.trim() : ""));
  }
  return defaultHeaders;
}

/**
 * Thêm một hoặc nhiều dòng vào Sheet
 */
export async function appendSheetRows(sheetName, rows) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  return await sheets.spreadsheets.values.append({
    spreadsheetId: ENV.SHEET_ID,
    range: sheetName,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows,
    },
  });
}

/**
 * Cập nhật một dòng theo chỉ số dòng (0-indexed so với data, tương ứng dòng rowIndex + 2 trên sheet)
 */
export async function updateSheetRow(sheetName, rowIndex, rowValues) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  const rowNum = Number(rowIndex) + 2;
  return await sheets.spreadsheets.values.update({
    spreadsheetId: ENV.SHEET_ID,
    range: `${sheetName}!A${rowNum}:Z${rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowValues],
    },
  });
}

/**
 * Xóa một dòng trong Sheet bằng cách xóa trắng các ô của dòng đó
 */
export async function clearSheetRow(sheetName, rowIndex, colCount = 26) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  const rowNum = Number(rowIndex) + 2;
  const emptyRow = new Array(colCount).fill("");
  return await sheets.spreadsheets.values.update({
    spreadsheetId: ENV.SHEET_ID,
    range: `${sheetName}!A${rowNum}:Z${rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [emptyRow],
    },
  });
}
