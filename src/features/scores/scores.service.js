import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  clearSheetRow,
} from "../../common/sheets.dao.js";

export async function getScores({ classId, month }) {
  const scores = await getSheetData("Scores");
  let filtered = scores;
  if (classId) {
    filtered = filtered.filter(s => String(s.classId || s["Class ID"]) === String(classId));
  }
  if (month) {
    filtered = filtered.filter(s => (s.month || s["Month"]) === month);
  }
  return filtered;
}

export async function createScore({ studentId, classId, month, score, note }) {
  await appendSheetRows("Scores", [
    [studentId, classId, month, score, note || ""],
  ]);
  return true;
}

export async function updateScoreByIndex(rowIndex, { score, note }) {
  const scores = await getSheetData("Scores");
  if (!scores[rowIndex]) return false;

  const headers = await getSheetHeaders("Scores");
  const updated = { ...scores[rowIndex] };
  if (score !== undefined) updated.Score = score;
  if (note !== undefined) updated.Note = note;

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("Scores", rowIndex, rowValues);
  return true;
}

export async function deleteScoreByIndex(rowIndex) {
  const headers = await getSheetHeaders("Scores");
  await clearSheetRow("Scores", rowIndex, headers.length);
  return true;
}
