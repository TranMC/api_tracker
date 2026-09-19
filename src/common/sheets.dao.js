import { sheets } from "../config/google.js";
import { ENV } from "../config/env.js";

const RETRYABLE_NETWORK_CODES = new Set([
  "EAI_AGAIN",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNRESET",
  "ECONNABORTED",
  "ERR_NETWORK",
]);

/**
 * Tự động thử lại khi gặp lỗi mạng hoặc DNS tạm thời
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1500) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const isNetworkError =
        RETRYABLE_NETWORK_CODES.has(err.code) ||
        (err.cause && RETRYABLE_NETWORK_CODES.has(err.cause.code)) ||
        err.message?.includes("ETIMEDOUT") ||
        err.message?.includes("EAI_AGAIN") ||
        (err.status >= 500 && err.status < 600);

      if (attempt <= maxRetries && isNetworkError) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`[SHEETS RETRY] Lỗi kết nối (${err.code || err.message}). Đang thử lại lần ${attempt}/${maxRetries} sau ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Lấy toàn bộ dữ liệu của một Sheet dưới dạng mảng các Object (key là tên cột ở dòng 1)
 */
export async function getSheetData(sheetName) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  return await withRetry(async () => {
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
  });
}

/**
 * Lấy danh sách tên các cột (Headers) của một Sheet
 */
export async function getSheetHeaders(sheetName, defaultHeaders = []) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  return await withRetry(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: ENV.SHEET_ID,
      range: sheetName,
    });
    if (res.data.values && res.data.values.length > 0) {
      return res.data.values[0].map(h => (h ? h.trim() : ""));
    }
    return defaultHeaders;
  });
}

/**
 * Thêm một hoặc nhiều dòng vào Sheet
 */
export async function appendSheetRows(sheetName, rows) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  return await withRetry(async () => {
    return await sheets.spreadsheets.values.append({
      spreadsheetId: ENV.SHEET_ID,
      range: sheetName,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });
  });
}

/**
 * Cập nhật một dòng theo chỉ số dòng (0-indexed so với data, tương ứng dòng rowIndex + 2 trên sheet)
 */
export async function updateSheetRow(sheetName, rowIndex, rowValues) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  const rowNum = Number(rowIndex) + 2;
  return await withRetry(async () => {
    return await sheets.spreadsheets.values.update({
      spreadsheetId: ENV.SHEET_ID,
      range: `${sheetName}!A${rowNum}:Z${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowValues],
      },
    });
  });
}

/**
 * Lấy numeric sheetId (gid) của tab dựa theo sheetName
 */
let sheetMetadataCache = null;
let lastMetadataFetch = 0;

export async function getSheetNumericId(sheetName) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  const now = Date.now();
  if (!sheetMetadataCache || now - lastMetadataFetch > 600000) {
    const res = await withRetry(async () => {
      return await sheets.spreadsheets.get({
        spreadsheetId: ENV.SHEET_ID,
        fields: "sheets(properties(sheetId,title))",
      });
    });
    sheetMetadataCache = res.data.sheets || [];
    lastMetadataFetch = now;
  }

  let found = sheetMetadataCache.find(
    (s) => s.properties?.title?.toLowerCase() === sheetName.toLowerCase()
  );

  if (!found) {
    const res = await withRetry(async () => {
      return await sheets.spreadsheets.get({
        spreadsheetId: ENV.SHEET_ID,
        fields: "sheets(properties(sheetId,title))",
      });
    });
    sheetMetadataCache = res.data.sheets || [];
    lastMetadataFetch = now;
    found = sheetMetadataCache.find(
      (s) => s.properties?.title?.toLowerCase() === sheetName.toLowerCase()
    );
  }

  if (found && found.properties?.sheetId !== undefined) {
    return found.properties.sheetId;
  }
  throw new Error(`Không tìm thấy sheet có tên "${sheetName}"`);
}

/**
 * Xóa hẳn một dòng (row) khỏi Sheet bằng Google Sheets API deleteDimension
 * rowIndex: 0-indexed đối với data (dòng 1 là header -> rowIndex 0 tương ứng dòng 2 trên sheet)
 */
export async function deleteSheetRow(sheetName, rowIndex) {
  if (!sheets) throw new Error("Google Sheets client is not initialized");
  if (rowIndex === undefined || rowIndex === null || rowIndex < 0) {
    throw new Error(`Invalid rowIndex: ${rowIndex}`);
  }
  const sheetId = await getSheetNumericId(sheetName);
  const startIndex = Number(rowIndex) + 1; // 0-based: row 1 (header) là 0, row 2 (data 0) là 1
  const endIndex = startIndex + 1;

  return await withRetry(async () => {
    return await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ENV.SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex,
                endIndex,
              },
            },
          },
        ],
      },
    });
  });
}

/**
 * Xóa một dòng trong Sheet: Thay vì xóa trắng các ô (để lại hàng rỗng),
 * hàm sẽ xóa hẳn hàng đó khỏi bảng tính.
 */
export async function clearSheetRow(sheetName, rowIndex, colCount = 26) {
  return await deleteSheetRow(sheetName, rowIndex);
}

/**
 * Dọn dẹp tất cả các dòng hoàn toàn rỗng trong Sheet
 */
export async function cleanEmptyRows(sheetName) {
  if (!sheets) return 0;
  return await withRetry(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: ENV.SHEET_ID,
      range: sheetName,
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return 0;

    const sheetId = await getSheetNumericId(sheetName);
    const deleteRequests = [];

    // Quét từ dưới lên trên để khi xóa index không bị thay đổi
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const isBlank =
        !row ||
        row.length === 0 ||
        row.every((cell) => cell === undefined || cell === null || String(cell).trim() === "");
      if (isBlank) {
        deleteRequests.push({
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: i,
              endIndex: i + 1,
            },
          },
        });
      }
    }

    if (deleteRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: ENV.SHEET_ID,
        requestBody: {
          requests: deleteRequests,
        },
      });
      console.log(`[CLEAN SHEET] Đã xóa ${deleteRequests.length} dòng trống khỏi sheet "${sheetName}".`);
    }
    return deleteRequests.length;
  });
}

