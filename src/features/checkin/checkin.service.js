import {
  getSheetData,
  appendSheetRows,
} from "../../common/sheets.dao.js";
import { formatTimestampVN } from "../../common/date.util.js";

export async function getCheckinTimeSlots(username) {
  const slots = await getSheetData("CheckInTime");
  let filtered = slots;
  if (username) {
    filtered = filtered.filter(s => !s.username || s.username === username);
  }
  return filtered.map(s => ({
    ...s,
    startTime: s.startTime,
    endTime: s.endTime,
    label: s.label,
  }));
}

function isEveningShift(startTime, slotLabel = "") {
  const label = (slotLabel || "").toLowerCase();
  return label.includes("tối") || (startTime >= "17:30" && startTime <= "22:00");
}

export async function validateCheckinLimits({ username, date, startTime, endTime, slotLabel }) {
  const allLogs = await getSheetData("CheckInLog");
  const todayLogs = allLogs.filter(
    l => l.username === username && l.date === date
  );

  // 1. Tối đa 3 ca trong một ngày
  if (todayLogs.length >= 3) {
    return {
      valid: false,
      message: "Trong một ngày bạn chỉ được chấm tối đa 3 ca!",
    };
  }

  // 2. Không được chấm trùng ca đã có
  const isDuplicate = todayLogs.some(
    l => l.startTime === startTime && l.endTime === endTime
  );
  if (isDuplicate) {
    return {
      valid: false,
      message: "Ca này đã được ghi nhận trong ngày hôm nay rồi!",
    };
  }

  // 3. Nếu là ca tối: Trong ngày chỉ được chấm duy nhất 1 ca tối
  if (isEveningShift(startTime, slotLabel)) {
    const hasEvening = todayLogs.some(l => isEveningShift(l.startTime, l.slotLabel));
    if (hasEvening) {
      return {
        valid: false,
        message: "Buổi tối chỉ được chấm duy nhất 1 ca trong ngày!",
      };
    }
  }

  return { valid: true };
}

export async function createCheckinLog({ username, date, startTime, endTime, slotLabel, totalHours }) {
  // Kiểm tra tính hợp lệ nghiệp vụ
  const check = await validateCheckinLimits({ username, date, startTime, endTime, slotLabel });
  if (!check.valid) {
    throw new Error(check.message);
  }

  await appendSheetRows("CheckInLog", [
    [username, date, startTime, endTime, slotLabel || "", totalHours || "", formatTimestampVN()],
  ]);
  return true;
}

export async function getCheckinLogs({ username, month }) {
  const logs = await getSheetData("CheckInLog");
  let filtered = logs;
  if (username) filtered = filtered.filter(l => l.username === username);
  if (month) filtered = filtered.filter(l => l.date && l.date.startsWith(month));
  return filtered;
}
