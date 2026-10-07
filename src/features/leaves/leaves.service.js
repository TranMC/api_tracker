import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  deleteSheetRow,
  ensureSheetExists,
} from "../../common/sheets.dao.js";
import { normalizeDate } from "../../common/date.util.js";

const SHEET_NAME = "LeaveRequests";
const LEAVE_HEADERS = [
  "id",
  "studentId",
  "studentName",
  "classId",
  "className",
  "leaveDate",
  "reason",
  "status",
  "needsMakeup",
  "makeupDate",
  "makeupSlotId",
  "makeupSlot",
  "makeupClassId",
  "makeupClassName",
  "createdAt",
  "updatedAt",
];

let isInitialized = false;
async function initSheetIfNeeded() {
  if (!isInitialized) {
    try {
      await ensureSheetExists(SHEET_NAME, LEAVE_HEADERS);
      isInitialized = true;
    } catch (e) {
      console.warn("[LeavesService] ensureSheetExists warning:", e.message);
    }
  }
}

export async function getAllLeaves({ studentId, classId, date, status } = {}) {
  await initSheetIfNeeded();
  let data = [];
  try {
    data = await getSheetData(SHEET_NAME);
  } catch (err) {
    console.warn("[LeavesService] Error getting leaves data:", err.message);
    return [];
  }

  const normQueryDate = date ? normalizeDate(date) : "";

  return data.filter((item) => {
    if (studentId && String(item.studentId || "").trim() !== String(studentId).trim()) {
      return false;
    }
    if (classId && String(item.classId || "").trim() !== String(classId).trim()) {
      return false;
    }
    if (status && String(item.status || "").trim() !== String(status).trim()) {
      return false;
    }
    if (normQueryDate && normalizeDate(item.leaveDate) !== normQueryDate) {
      return false;
    }
    return true;
  });
}

export async function createLeave(leaveData) {
  await initSheetIfNeeded();
  const headers = await getSheetHeaders(SHEET_NAME, LEAVE_HEADERS);
  const now = new Date().toISOString();

  const id =
    leaveData.id || `leave_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newRecord = {
    id,
    studentId: leaveData.studentId || "",
    studentName: leaveData.studentName || "",
    classId: leaveData.classId || "",
    className: leaveData.className || "",
    leaveDate: leaveData.leaveDate || "",
    reason: leaveData.reason || "",
    status:
      leaveData.status ||
      (leaveData.needsMakeup === false || leaveData.needsMakeup === "false"
        ? "no_makeup"
        : "pending_makeup"),
    needsMakeup:
      leaveData.needsMakeup === false || leaveData.needsMakeup === "false" ? "false" : "true",
    makeupDate: leaveData.makeupDate || "",
    makeupSlotId: leaveData.makeupSlotId || "",
    makeupSlot: leaveData.makeupSlot || "",
    makeupClassId: leaveData.makeupClassId || "",
    makeupClassName: leaveData.makeupClassName || "",
    createdAt: leaveData.createdAt || now,
    updatedAt: now,
  };

  const rowValues = headers.map((h) => (newRecord[h] !== undefined ? String(newRecord[h]) : ""));
  await appendSheetRows(SHEET_NAME, [rowValues]);
  return newRecord;
}

export async function updateLeaveById(id, updateData) {
  await initSheetIfNeeded();
  const data = await getSheetData(SHEET_NAME);
  const rowIndex = data.findIndex((item) => String(item.id || "").trim() === String(id).trim());

  if (rowIndex === -1) {
    return null;
  }

  const headers = await getSheetHeaders(SHEET_NAME, LEAVE_HEADERS);
  const updatedItem = {
    ...data[rowIndex],
    ...updateData,
    updatedAt: new Date().toISOString(),
  };

  const rowValues = headers.map((h) => (updatedItem[h] !== undefined ? String(updatedItem[h]) : ""));
  await updateSheetRow(SHEET_NAME, rowIndex, rowValues);
  return updatedItem;
}

export async function deleteLeaveById(id) {
  await initSheetIfNeeded();
  const data = await getSheetData(SHEET_NAME);
  const rowIndex = data.findIndex((item) => String(item.id || "").trim() === String(id).trim());

  if (rowIndex === -1) {
    return false;
  }

  await deleteSheetRow(SHEET_NAME, rowIndex);
  return true;
}
