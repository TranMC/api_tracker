import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  clearSheetRow,
} from "../../common/sheets.dao.js";
import { normalizeDate } from "../../common/date.util.js";

export async function getDashboardStats() {
  const today = new Date().toISOString().split("T")[0];
  const attendance = await getSheetData("AttendanceCriteria");
  let present = 0;
  let absent = 0;

  attendance.forEach(a => {
    if (a.Date === today) {
      if (a.Status === "present") present++;
      if (a.Status === "absent") absent++;
    }
  });

  return { present, absent };
}

export async function getAllAttendance() {
  return await getSheetData("AttendanceCriteria");
}

export async function getAttendanceByClassAndDate(classId, date, username) {
  const attendance = await getSheetData("AttendanceCriteria");
  const normDate = normalizeDate(date);

  let filtered = attendance.filter(
    a => String(a["Class ID"]) === String(classId) && normalizeDate(a.Date) === normDate
  );

  if (username) {
    filtered = filtered.filter(a => a.username === username);
  }

  return filtered;
}

export async function updateAttendanceById(attendanceId, { status, note }) {
  const [studentId, classId, date] = attendanceId.split("_");
  const attendance = await getSheetData("AttendanceCriteria");
  const rowIndex = attendance.findIndex(
    a =>
      String(a["Student ID"]) === String(studentId) &&
      String(a["Class ID"]) === String(classId) &&
      String(a["Date"]) === String(date)
  );
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("AttendanceCriteria");
  const updated = { ...attendance[rowIndex] };
  if (status !== undefined) updated.Status = status;
  if (note !== undefined) updated.Note = note;

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("AttendanceCriteria", rowIndex, rowValues);
  return true;
}

export async function deleteAttendanceById(attendanceId) {
  const [studentId, classId, date] = attendanceId.split("_");
  const attendance = await getSheetData("AttendanceCriteria");
  const rowIndex = attendance.findIndex(
    a =>
      String(a["Student ID"]) === String(studentId) &&
      String(a["Class ID"]) === String(classId) &&
      String(a["Date"]) === String(date)
  );
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("AttendanceCriteria");
  await clearSheetRow("AttendanceCriteria", rowIndex, headers.length);
  return true;
}

export async function getAttendanceCriteria({ studentId, classId, date, username, slotId }) {
  const data = await getSheetData("AttendanceCriteria");

  if (studentId && classId && date && username) {
    const idx = data.findIndex(
      r =>
        r["Student ID"] === studentId &&
        r["Class ID"] === classId &&
        r["Date"] === date &&
        r["username"] === username &&
        (!slotId || !r.SlotId || String(r.SlotId) === String(slotId))
    );
    return { rowIndex: idx !== -1 ? idx : null };
  }

  if (username) {
    let filtered = data.filter(r => (r["username"] || "").trim() === username);
    if (classId) filtered = filtered.filter(r => String(r["Class ID"]) === String(classId));
    if (date) filtered = filtered.filter(r => String(r["Date"]) === String(date));
    if (slotId) {
      filtered = filtered.filter(r => !r.SlotId || String(r.SlotId) === String(slotId));
    }
    return filtered;
  }

  return data;
}

export async function createAttendanceCriteria(body) {
  const headers = await getSheetHeaders("AttendanceCriteria");
  const fields = [
    "StudentID", "StudentName", "ClassID", "ClassName", "Date", "Status",
    "Attitude", "Homework", "Worksheet", "Notebook", "Attendance", "TotalScore",
    "Note", "Timestamp", "username", "SlotId", "AttendanceType"
  ];
  const rowObj = {
    ...body,
    AttendanceType: body.AttendanceType || "official",
  };
  const row = headers.length > 0
    ? headers.map(h => (rowObj[h] !== undefined ? rowObj[h] : ""))
    : fields.map(f => (rowObj[f] !== undefined ? rowObj[f] : ""));
  await appendSheetRows("AttendanceCriteria", [row]);
  return true;
}

export async function upsertAttendanceCriteria(body) {
  const headers = await getSheetHeaders("AttendanceCriteria");
  const data = await getSheetData("AttendanceCriteria");
  const { "Student ID": studentId, "Class ID": classId, Date: date, username, SlotId: slotId } = body;

  const idx = data.findIndex(
    r =>
      r["Student ID"] === studentId &&
      r["Class ID"] === classId &&
      r["Date"] === date &&
      r["username"] === username &&
      (!slotId || !r.SlotId || String(r.SlotId) === String(slotId))
  );

  if (idx !== -1) {
    const updated = { ...data[idx] };
    for (const key in body) {
      if (headers.includes(key)) updated[key] = body[key];
    }
    const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
    await updateSheetRow("AttendanceCriteria", idx, rowValues);
    return { updated: true };
  } else {
    const rowObj = {
      "Student ID": studentId,
      StudentName: body.StudentName || "",
      "Class ID": classId,
      ClassName: body.ClassName || "",
      Date: date,
      Status: body.Status || "absent",
      Attitude: body.Attitude !== undefined ? body.Attitude : "",
      Homework: body.Homework !== undefined ? body.Homework : "",
      Worksheet: body.Worksheet !== undefined ? body.Worksheet : "",
      Notebook: body.Notebook !== undefined ? body.Notebook : "",
      TotalScore: body.TotalScore !== undefined ? body.TotalScore : "",
      Note: body.Note || "",
      Timestamp: body.Timestamp || "",
      username: username || "",
      SlotId: slotId || "",
      AttendanceType: body.AttendanceType || "official",
    };
    const rowValues = headers.map(h => (rowObj[h] !== undefined ? rowObj[h] : (body[h] !== undefined ? body[h] : "")));
    await appendSheetRows("AttendanceCriteria", [rowValues]);
    return { created: true };
  }
}

export async function updateAttendanceCriteriaByIndex(rowIndex, body) {
  const data = await getSheetData("AttendanceCriteria");
  if (!data[rowIndex]) return false;

  const headers = await getSheetHeaders("AttendanceCriteria");
  const updated = { ...data[rowIndex] };
  for (const key in body) {
    if (headers.includes(key)) updated[key] = body[key];
  }

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("AttendanceCriteria", rowIndex, rowValues);
  return true;
}

export async function deleteAttendanceCriteriaByIndex(rowIndex) {
  const headers = await getSheetHeaders("AttendanceCriteria");
  await clearSheetRow("AttendanceCriteria", rowIndex, headers.length);
  return true;
}
