import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  clearSheetRow,
} from "../../common/sheets.dao.js";

export async function getAllStudents() {
  return await getSheetData("Students");
}

export async function createStudent({ studentId, name, grade, email, classId }) {
  const finalId = studentId || `STU_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await appendSheetRows("Students", [
    [finalId, name, grade || "", email || "", classId],
  ]);
  return finalId;
}

export async function addStudentToClass(studentId, classId) {
  const students = await getSheetData("Students");
  const rowIndex = students.findIndex(
    s => s["Student ID"] === studentId || s.studentId === studentId || s["Mã học sinh"] === studentId
  );
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("Students");
  const updated = { ...students[rowIndex] };
  let current = updated["Class ID"] || updated.classId || "";
  let arr = current.split(",").map(x => x.trim()).filter(Boolean);
  if (!arr.includes(classId)) arr.push(classId);
  updated["Class ID"] = arr.join(",");

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("Students", rowIndex, rowValues);
  return true;
}

export async function removeStudentFromClass(studentId, classId) {
  const students = await getSheetData("Students");
  const rowIndex = students.findIndex(
    s => s["Student ID"] === studentId || s.studentId === studentId || s["Mã học sinh"] === studentId
  );
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("Students");
  const updated = { ...students[rowIndex] };
  let current = updated["Class ID"] || updated.classId || "";
  let arr = current.split(",").map(x => x.trim()).filter(Boolean);
  arr = arr.filter(id => id !== classId);
  updated["Class ID"] = arr.join(",");

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("Students", rowIndex, rowValues);
  return true;
}

export async function updateStudent(studentId, { name, grade, email, classId, classSchedules }) {
  const students = await getSheetData("Students");
  const rowIndex = students.findIndex(
    s => s["Student ID"] === studentId || s.studentId === studentId || s["Mã học sinh"] === studentId
  );
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("Students");
  const updated = { ...students[rowIndex] };
  if (name !== undefined) updated.Name = name;
  if (grade !== undefined) updated.Grade = grade;
  if (email !== undefined) updated.Email = email;
  if (classId !== undefined) updated["Class ID"] = classId;
  if (classSchedules !== undefined) {
    updated.ClassSchedules = typeof classSchedules === "string" ? classSchedules : JSON.stringify(classSchedules);
  }

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("Students", rowIndex, rowValues);
  return true;
}

export async function updateStudentSchedules(studentId, classId, slotIds) {
  const students = await getSheetData("Students");
  const rowIndex = students.findIndex(
    s => s["Student ID"] === studentId || s.studentId === studentId || s["Mã học sinh"] === studentId
  );
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("Students");
  const updated = { ...students[rowIndex] };
  let currentMap = {};
  if (updated.ClassSchedules) {
    try {
      currentMap = typeof updated.ClassSchedules === "string" ? JSON.parse(updated.ClassSchedules) : updated.ClassSchedules;
    } catch (e) {
      currentMap = {};
    }
  }

  if (Array.isArray(slotIds) && slotIds.length > 0) {
    currentMap[classId] = slotIds;
  } else {
    delete currentMap[classId];
  }

  updated.ClassSchedules = JSON.stringify(currentMap);
  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("Students", rowIndex, rowValues);
  return true;
}

export async function deleteStudent(studentId) {
  const students = await getSheetData("Students");
  const rowIndex = students.findIndex(
    s => s["Student ID"] === studentId || s.studentId === studentId || s["Mã học sinh"] === studentId
  );
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("Students");
  await clearSheetRow("Students", rowIndex, headers.length);
  return true;
}
