import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  clearSheetRow,
} from "../../common/sheets.dao.js";

const DAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export async function getTodayClasses() {
  const today = new Date();
  const classes = await getSheetData("Classes");
  const students = await getSheetData("Students");
  const todayStr = today.toISOString().split("T")[0];
  const jsDay = today.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
  const todayDayName = DAY_NAMES[jsDay];

  const result = [];

  for (const c of classes) {
    const classId = c["Class ID"] || c.ID || c.Id || c.id;
    let schedules = [];
    if (c.Schedules) {
      try {
        schedules = typeof c.Schedules === "string" ? JSON.parse(c.Schedules) : c.Schedules;
      } catch (e) {
        schedules = [];
      }
    }

    // Nếu lớp có cấu hình ca định kỳ (Schedules)
    if (Array.isArray(schedules) && schedules.length > 0) {
      const matchingSlots = schedules.filter(s => {
        return (
          Number(s.dayOfWeek) === jsDay ||
          s.dayLabel === todayDayName ||
          String(s.dayOfWeek) === String(jsDay)
        );
      });

      matchingSlots.forEach((slot, sIdx) => {
        const sId = slot.id || `slot_${slot.dayOfWeek}_${slot.startTime || sIdx}`;
        const count = students.filter(s => {
          const classIds = (s["Class ID"] || s.classId || "").split(",").map(x => x.trim());
          if (!classIds.includes(classId)) return false;

          if (sId && s.ClassSchedules) {
            try {
              const map = typeof s.ClassSchedules === "string" ? JSON.parse(s.ClassSchedules) : s.ClassSchedules;
              const slots = map[classId];
              if (Array.isArray(slots) && slots.length > 0) {
                return slots.includes(sId) || (slot.id && slots.includes(slot.id));
              }
            } catch (e) {}
          }
          return true;
        }).length;

        result.push({
          id: classId,
          classId: classId,
          slotId: sId,
          slotLabel: slot.label || `${slot.startTime} - ${slot.endTime}`,
          name: c.Name || c.name,
          startTime: slot.startTime || c["Start Time"] || c.startTime,
          endTime: slot.endTime || c["End Time"] || c.endTime,
          room: slot.room || c.Room || c.room,
          isActive: true,
          studentsCount: count,
        });
      });
    } else {
      // Tương thích ngược: Lớp cũ không có Schedules
      const isToday = c.Date ? c.Date === todayStr : true;
      if (isToday) {
        result.push({
          id: classId,
          classId: classId,
          slotId: "",
          slotLabel: "",
          name: c.Name || c.name,
          startTime: c["Start Time"] || c.startTime,
          endTime: c["End Time"] || c.endTime,
          room: c["Room"] || c.room,
          isActive: true,
          studentsCount: students.filter(s => {
            const classIds = (s["Class ID"] || s.classId || "").split(",").map(x => x.trim());
            return classIds.includes(classId);
          }).length,
        });
      }
    }
  }

  return result;
}

export async function getAllClasses() {
  const classes = await getSheetData("Classes");
  return classes.map(item => {
    let schedules = [];
    if (item.Schedules) {
      try {
        schedules = typeof item.Schedules === "string" ? JSON.parse(item.Schedules) : item.Schedules;
      } catch (e) {
        schedules = [];
      }
    }
    if (Array.isArray(schedules)) {
      schedules = schedules.map((s, idx) => ({
        ...s,
        id: s.id || `slot_${s.dayOfWeek}_${s.startTime || idx}`,
      }));
    } else {
      schedules = [];
    }
    return {
      ...item,
      id: item["Class ID"] || item.ID || item.Id || item.id,
      schedules,
    };
  });
}

export async function createClass({ id, name, startTime, endTime, room, schedules }) {
  const finalId = id || `CLASS_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const schedulesStr = schedules
    ? typeof schedules === "string"
      ? schedules
      : JSON.stringify(schedules)
    : "";

  const headers = await getSheetHeaders("Classes");
  const hasSchedulesCol = headers.includes("Schedules");

  const row = [finalId, name, startTime || "", endTime || "", room || "", "", "", "TRUE"];
  if (hasSchedulesCol) {
    row.push(schedulesStr);
  }
  await appendSheetRows("Classes", [row]);
  return finalId;
}

export async function updateClass(id, { name, startTime, endTime, room, schedules }) {
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
  if (schedules !== undefined) {
    updated.Schedules = typeof schedules === "string" ? schedules : JSON.stringify(schedules);
  }

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

export async function getStudentsByClassId(classId, slotId) {
  const students = await getSheetData("Students");
  return students.filter(s => {
    const classIds = (s["Class ID"] || s.classId || "")
      .split(",")
      .map(x => x.trim());
    if (!classIds.includes(classId)) return false;

    if (slotId && s.ClassSchedules) {
      try {
        const map = typeof s.ClassSchedules === "string" ? JSON.parse(s.ClassSchedules) : s.ClassSchedules;
        const slots = map[classId];
        if (Array.isArray(slots) && slots.length > 0) {
          return slots.includes(slotId);
        }
      } catch (e) {}
    }
    return true;
  });
}

