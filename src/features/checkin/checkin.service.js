import {
  getSheetData,
  appendSheetRows,
} from "../../common/sheets.dao.js";
import {
  formatTimestampVN,
  getNowVN,
  getTodayVNString,
  timeToMinutes,
} from "../../common/date.util.js";

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

function isLiveShift(slotLabel = "") {
  const label = (slotLabel || "").toLowerCase();
  return label.includes("live") || label.includes("thời gian thực") || label.includes("linh hoạt");
}

export async function validateCheckinLimits({ username, date, startTime, endTime, slotLabel }) {
  const nowVN = getNowVN();
  const todayVN = getTodayVNString();
  const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();
  const isLive = isLiveShift(slotLabel);

  // 1. Kiểm tra giới hạn chấm công Live: Sau 22h30 không cho phép chấm cho tới 7h sáng hôm sau
  if (isLive) {
    const startMinutes = timeToMinutes(startTime);
    // Nếu bắt đầu ca trong khung giờ cấm (22:30 -> 07:00)
    if (startMinutes >= 22 * 60 + 30 || startMinutes < 7 * 60) {
      return {
        valid: false,
        message: "Hệ thống không cho phép chấm công live từ 22:30 đến 07:00 sáng hôm sau!",
      };
    }
  } else {
    // 2. Kiểm tra ca cố định: Quá giờ không cho chấm
    if (date < todayVN) {
      return {
        valid: false,
        message: "Không thể chấm công cho ca làm việc của ngày trong quá khứ!",
      };
    }
    if (date > todayVN) {
      return {
        valid: false,
        message: "Không thể chấm công trước cho ngày trong tương lai!",
      };
    }
    if (date === todayVN) {
      const endMinutes = timeToMinutes(endTime);
      const GRACE_PERIOD_MINUTES = 15; // Ân hạn tối đa 15 phút sau khi tan ca
      if (currentMinutes > endMinutes + GRACE_PERIOD_MINUTES) {
        return {
          valid: false,
          message: "Ca làm việc này đã quá giờ quy định, không thể chấm công!",
        };
      }
    }
  }

  const allLogs = await getSheetData("CheckInLog");
  const todayLogs = allLogs.filter(
    l => l.username === username && l.date === date
  );

  // 3. Tối đa 3 ca trong một ngày
  if (todayLogs.length >= 3) {
    return {
      valid: false,
      message: "Trong một ngày bạn chỉ được chấm tối đa 3 ca!",
    };
  }

  // 4. Không được chấm trùng ca đã có
  const isDuplicate = todayLogs.some(
    l => l.startTime === startTime && l.endTime === endTime
  );
  if (isDuplicate) {
    return {
      valid: false,
      message: "Ca này đã được ghi nhận trong ngày hôm nay rồi!",
    };
  }

  // 5. Nếu là ca tối: Trong ngày chỉ được chấm duy nhất 1 ca tối
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
