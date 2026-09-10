import {
  getMonthlySummary,
  createMonthlySummary,
  updateMonthlySummaryByIndex,
  deleteMonthlySummaryByIndex,
  calculateMonthlySummaryLive,
  materializeMonthlySummary,
} from "./monthlySummary.service.js";

export async function getMonthlySummaryHandler(req, res, next) {
  try {
    const { classId, month, username } = req.query;
    const data = await getMonthlySummary({ classId, month, username });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createMonthlySummaryHandler(req, res, next) {
  try {
    const { studentId, classId, month } = req.body;
    if (!studentId || !classId || !month) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }
    await createMonthlySummary(req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function updateMonthlySummaryByIndexHandler(req, res, next) {
  try {
    const { rowIndex } = req.params;
    const success = await updateMonthlySummaryByIndex(rowIndex, req.body);
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi tổng kết" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteMonthlySummaryByIndexHandler(req, res, next) {
  try {
    const { rowIndex } = req.params;
    await deleteMonthlySummaryByIndex(rowIndex);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getMonthlySummaryLiveHandler(req, res, next) {
  try {
    const { classId, month } = req.query;
    if (!classId || !month) {
      return res.status(400).json({ error: "Thiếu classId hoặc month" });
    }
    const data = await calculateMonthlySummaryLive(classId, month);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function materializeMonthlySummaryHandler(req, res, next) {
  try {
    const classId = (req.body && req.body.classId) || req.query.classId;
    const month = (req.body && req.body.month) || req.query.month;
    if (!classId || !month) {
      return res.status(400).json({ error: "Thiếu classId hoặc month" });
    }
    const result = await materializeMonthlySummary(classId, month);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
