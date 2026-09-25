import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục data nằm ở root của api_tracker
const DATA_DIR = path.resolve(__dirname, "../../../data");
const SETTINGS_FILE = path.join(DATA_DIR, "system_settings.json");

const DEFAULT_SETTINGS = {
  criteriaEnabled: true, // Mặc định bật đánh giá tiêu chí
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

let cachedSettings = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getSettings() {
  if (cachedSettings) return cachedSettings;

  try {
    ensureDataDir();
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
      return cachedSettings;
    }
  } catch (err) {
    console.error("[Settings Service] Lỗi khi đọc settings, dùng mặc định:", err);
  }

  cachedSettings = { ...DEFAULT_SETTINGS };
  try {
    ensureDataDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cachedSettings, null, 2), "utf-8");
  } catch (e) {
    console.error("[Settings Service] Lỗi khi lưu settings mặc định:", e);
  }

  return cachedSettings;
}

export function updateSettings(updates = {}) {
  const current = getSettings();
  const nextSettings = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  cachedSettings = nextSettings;

  try {
    ensureDataDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(nextSettings, null, 2), "utf-8");
  } catch (err) {
    console.error("[Settings Service] Lỗi khi ghi settings:", err);
    throw new Error("Không thể lưu cấu hình hệ thống");
  }

  return cachedSettings;
}
