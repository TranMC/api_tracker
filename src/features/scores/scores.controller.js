import {
  getScores,
  createScore,
  updateScoreByIndex,
  deleteScoreByIndex,
} from "./scores.service.js";

export async function getScoresHandler(req, res, next) {
  try {
    const { classId, month, studentId } = req.query;
    const data = await getScores({ classId, month, studentId });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createScoreHandler(req, res, next) {
  try {
    const { studentId, classId, month, score, note } = req.body;
    if (!studentId || !classId || !month) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }
    await createScore({ studentId, classId, month, score, note });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function updateScoreByIndexHandler(req, res, next) {
  try {
    const { rowIndex } = req.params;
    const { score, note } = req.body;
    const success = await updateScoreByIndex(rowIndex, { score, note });
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteScoreByIndexHandler(req, res, next) {
  try {
    const { rowIndex } = req.params;
    await deleteScoreByIndex(rowIndex);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
