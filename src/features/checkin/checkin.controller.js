import {
  getCheckinTimeSlots,
  createCheckinLog,
  getCheckinLogs,
} from "./checkin.service.js";

export async function getCheckinTimeSlotsHandler(req, res, next) {
  try {
    const { username } = req.query;
    const data = await getCheckinTimeSlots(username);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createCheckinLogHandler(req, res, next) {
  try {
    const { username, date, startTime, endTime, slotLabel, totalHours } = req.body;
    if (!username || !date || !startTime || !endTime) {
      return res.status(400).json({ error: "Thiếu thông tin checkin" });
    }

    await createCheckinLog({ username, date, startTime, endTime, slotLabel, totalHours });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Không thể lưu ca làm việc" });
  }
}

export async function getCheckinLogsHandler(req, res, next) {
  try {
    const { username, month } = req.query;
    const data = await getCheckinLogs({ username, month });
    res.json(data);
  } catch (err) {
    next(err);
  }
}
