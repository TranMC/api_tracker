import {
  getDashboardStats,
  getAllAttendance,
  getAttendanceByClassAndDate,
  updateAttendanceById,
  deleteAttendanceById,
  getAttendanceCriteria,
  createAttendanceCriteria,
  upsertAttendanceCriteria,
  updateAttendanceCriteriaByIndex,
  deleteAttendanceCriteriaByIndex,
} from "./attendance.service.js";

export async function getDashboardStatsHandler(req, res, next) {
  try {
    const data = await getDashboardStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAllAttendanceHandler(req, res, next) {
  try {
    const data = await getAllAttendance();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceByClassAndDateHandler(req, res, next) {
  try {
    const { classId, date } = req.params;
    const { username } = req.query;
    const data = await getAttendanceByClassAndDate(classId, date, username);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateAttendanceHandler(req, res, next) {
  try {
    const { attendanceId } = req.params;
    const { status, note } = req.body;
    const success = await updateAttendanceById(attendanceId, { status, note });
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm danh" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteAttendanceHandler(req, res, next) {
  try {
    const { attendanceId } = req.params;
    const success = await deleteAttendanceById(attendanceId);
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm danh" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceCriteriaHandler(req, res, next) {
  try {
    const { studentId, classId, date, username, slotId } = req.query;
    const data = await getAttendanceCriteria({ studentId, classId, date, username, slotId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createAttendanceCriteriaHandler(req, res, next) {
  try {
    await createAttendanceCriteria(req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function upsertAttendanceCriteriaHandler(req, res, next) {
  try {
    const result = await upsertAttendanceCriteria(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateAttendanceCriteriaByIndexHandler(req, res, next) {
  try {
    const { rowIndex } = req.params;
    const success = await updateAttendanceCriteriaByIndex(rowIndex, req.body);
    if (!success) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteAttendanceCriteriaByIndexHandler(req, res, next) {
  try {
    const { rowIndex } = req.params;
    await deleteAttendanceCriteriaByIndex(rowIndex);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
