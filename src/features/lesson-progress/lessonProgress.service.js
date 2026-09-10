import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  clearSheetRow,
} from "../../common/sheets.dao.js";

export async function getLessonProgress({ classId, date }) {
  const data = await getSheetData("LessonProgress");
  let filtered = data;
  if (classId) filtered = filtered.filter(r => String(r.ClassID) === String(classId));
  if (date) filtered = filtered.filter(r => r.Date === date);
  return filtered;
}

export async function createLessonProgress({
  Date,
  ClassID,
  LessonContent,
  LessonImages,
  HomeworkContent,
  HomeworkImages,
  HomeworkCheckDate,
  GeneralNote,
  NotificationSent,
}) {
  await appendSheetRows("LessonProgress", [
    [
      Date,
      ClassID,
      LessonContent || "",
      LessonImages || "",
      HomeworkContent || "",
      HomeworkImages || "",
      HomeworkCheckDate || "",
      GeneralNote || "",
      NotificationSent || "",
      "", // Checked
      "", // Pushed
    ],
  ]);
  return true;
}

export async function updateLessonProgressByIndex(rowIndex, body) {
  const data = await getSheetData("LessonProgress");
  if (!data[rowIndex]) return false;

  const headers = await getSheetHeaders("LessonProgress");
  const updated = { ...data[rowIndex] };

  if (body.LessonContent !== undefined) updated.LessonContent = body.LessonContent;
  if (body.LessonImages !== undefined) updated.LessonImages = body.LessonImages;
  if (body.HomeworkContent !== undefined) updated.HomeworkContent = body.HomeworkContent;
  if (body.HomeworkImages !== undefined) updated.HomeworkImages = body.HomeworkImages;
  if (body.HomeworkCheckDate !== undefined) updated.HomeworkCheckDate = body.HomeworkCheckDate;
  if (body.GeneralNote !== undefined) updated.GeneralNote = body.GeneralNote;
  if (body.NotificationSent !== undefined) updated.NotificationSent = body.NotificationSent;
  if (body.Checked !== undefined) updated.Checked = body.Checked;
  if (body.Pushed !== undefined) updated.Pushed = body.Pushed;

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("LessonProgress", rowIndex, rowValues);
  return true;
}

export async function deleteLessonProgressByIndex(rowIndex) {
  const headers = await getSheetHeaders("LessonProgress");
  await clearSheetRow("LessonProgress", rowIndex, headers.length);
  return true;
}
