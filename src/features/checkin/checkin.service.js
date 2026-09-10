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

export async function createCheckinLog({ username, date, startTime, endTime, slotLabel, totalHours }) {
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
