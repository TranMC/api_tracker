import {
  getLessonProgress,
  createLessonProgress,
  updateLessonProgressByIndex,
  deleteLessonProgressByIndex,
} from "./lessonProgress.service.js";

export async function getLessonProgressHandler(req, res, next) {
  try {
    const { classId, date } = req.query;
    const data = await getLessonProgress({ classId, date });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createLessonProgressHandler(req, res, next) {
  try {
    const { Date, ClassID } = req.body;
    if (!Date || !ClassID) {
      return res.status(400).json({ error: "Missing required fields Date or ClassID" });
    }

    await createLessonProgress(req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function updateLessonProgressByIndexHandler(req, res, next) {
  try {
    const { rowIndex } = req.params;
    const success = await updateLessonProgressByIndex(rowIndex, req.body);
    if (!success) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteLessonProgressByIndexHandler(req, res, next) {
  try {
    const { rowIndex } = req.params;
    await deleteLessonProgressByIndex(rowIndex);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
