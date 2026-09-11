/**
 * Format timestamp về dạng DD/MM/YYYY HH:mm:ss (Giờ Việt Nam)
 */
export function formatTimestampVN(date = new Date()) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hour}:${min}:${sec}`;
}

/**
 * Chuẩn hóa chuỗi ngày về dạng YYYY-MM-DD
 */
export function normalizeDate(d) {
  if (!d) return "";
  const cleaned = String(d).trim().replace(/\//g, "-");
  const parts = cleaned.split("-");
  // Nếu là DD-MM-YYYY thì chuyển về YYYY-MM-DD
  if (parts.length === 3 && parts[2].length === 4 && parts[0].length === 2) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return cleaned;
}

/**
 * Lấy Date object hoặc thông tin giờ hiện tại theo múi giờ Việt Nam (UTC+7)
 */
export function getNowVN() {
  const now = new Date();
  const vnString = now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
  return new Date(vnString);
}

/**
 * Lấy ngày hôm nay theo giờ Việt Nam dạng YYYY-MM-DD
 */
export function getTodayVNString() {
  const vn = getNowVN();
  const year = vn.getFullYear();
  const month = String(vn.getMonth() + 1).padStart(2, "0");
  const day = String(vn.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Đổi "HH:mm" thành số phút từ đầu ngày
 */
export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}


