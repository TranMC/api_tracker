import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  clearSheetRow,
} from "../../common/sheets.dao.js";
import { normalizeDate } from "../../common/date.util.js";

export async function getLessonProgress({ classId, date }) {
  const data = await getSheetData("LessonProgress");
  const normQueryDate = date ? normalizeDate(date) : "";

  // Gắn _rowIndex để client có thể theo dõi chính xác dòng cần sửa
  const withIndex = data.map((r, i) => ({ ...r, _rowIndex: i }));

  let filtered = withIndex;
  if (classId) {
    filtered = filtered.filter(
      r => String(r.ClassID || "").trim() === String(classId).trim()
    );
  }
  if (normQueryDate) {
    filtered = filtered.filter(r => normalizeDate(r.Date) === normQueryDate);
  }
  return filtered;
}

export async function createLessonProgress(body) {
  const {
    Date: pDate,
    ClassID: pClassId,
    LessonContent,
    LessonImages,
    HomeworkContent,
    HomeworkImages,
    HomeworkCheckDate,
    GeneralNote,
    NotificationSent,
    _rowIndex,
  } = body;

  const data = await getSheetData("LessonProgress");

  // 1. Nếu client truyền _rowIndex rõ ràng
  if (_rowIndex !== undefined && _rowIndex !== null && _rowIndex !== "") {
    const idx = Number(_rowIndex);
    if (!isNaN(idx) && data[idx]) {
      return await updateLessonProgressByIndex(idx, body);
    }
  }

  // 2. Tìm kiếm xem buổi học này đã có dòng tiến trình nào chưa (theo ClassID và Date)
  const normTargetDate = normalizeDate(pDate);
  const existingIdx = data.findIndex(
    r =>
      String(r.ClassID || "").trim() === String(pClassId || "").trim() &&
      normalizeDate(r.Date) === normTargetDate
  );

  // Nếu đã tồn tại -> Cập nhật trực tiếp bản ghi cũ thay vì append dòng mới trùng lặp
  if (existingIdx !== -1) {
    return await updateLessonProgressByIndex(existingIdx, body);
  }

  // 3. Nếu chưa tồn tại -> Thêm dòng mới
  await appendSheetRows("LessonProgress", [
    [
      pDate,
      pClassId,
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
