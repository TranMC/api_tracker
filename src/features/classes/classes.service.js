import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  clearSheetRow,
} from "../../common/sheets.dao.js";

export async function getTodayClasses() {
  const today = new Date();
  const classes = await getSheetData("Classes");
  const students = await getSheetData("Students");
  const todayStr = today.toISOString().split("T")[0];

  const todayClasses = classes.filter(c => {
    if (c.Date) return c.Date === todayStr;
    return true;
  });

  return todayClasses.map(c => {
    const classId = c["Class ID"] || c.ID || c.Id || c.id;
    return {
      id: classId,
      name: c.Name || c.name,
      startTime: c["Start Time"] || c.startTime,
      endTime: c["End Time"] || c.endTime,
      room: c["Room"] || c.room,
      isActive: true,
      studentsCount: students.filter(s => {
        const classIds = (s["Class ID"] || s.classId || "")
          .split(",")
          .map(x => x.trim());
        return classIds.includes(classId);
      }).length,
    };
  });
}

export async function getAllClasses() {
  const classes = await getSheetData("Classes");
  return classes.map(item => ({
    ...item,
    id: item["Class ID"] || item.ID || item.Id || item.id,
  }));
}

export async function createClass({ id, name, startTime, endTime, room }) {
  const finalId = id || `CLASS_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await appendSheetRows("Classes", [
    [finalId, name, startTime, endTime, room || "", "", "", "TRUE"],
  ]);
  return finalId;
}

export async function updateClass(id, { name, startTime, endTime, room }) {
  const classes = await getSheetData("Classes");
  const rowIndex = classes.findIndex(
    c => c["Class ID"] === id || c.ID === id || c.Id === id || c.id === id
  );
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("Classes");
  const updated = { ...classes[rowIndex] };
  if (name !== undefined) updated.Name = name;
  if (startTime !== undefined) updated["Start Time"] = startTime;
  if (endTime !== undefined) updated["End Time"] = endTime;
  if (room !== undefined) updated.Room = room;

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("Classes", rowIndex, rowValues);
  return true;
}

export async function deleteClass(id) {
  const classes = await getSheetData("Classes");
  const rowIndex = classes.findIndex(
    c => c["Class ID"] === id || c.ID === id || c.Id === id || c.id === id
  );
  if (rowIndex === -1) return false;

  const headers = await getSheetHeaders("Classes");
  await clearSheetRow("Classes", rowIndex, headers.length);
  return true;
}

export async function getStudentsByClassId(classId) {
  const students = await getSheetData("Students");
  return students.filter(s => {
    const classIds = (s["Class ID"] || s.classId || "")
      .split(",")
      .map(x => x.trim());
    return classIds.includes(classId);
  });
}
