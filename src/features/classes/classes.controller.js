import {
  getTodayClasses,
  getAllClasses,
  createClass,
  updateClass,
  deleteClass,
  getStudentsByClassId,
} from "./classes.service.js";

export async function getTodayClassesHandler(req, res, next) {
  try {
    const data = await getTodayClasses();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAllClassesHandler(req, res, next) {
  try {
    const data = await getAllClasses();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createClassHandler(req, res, next) {
  try {
    const { id, name, startTime, endTime, room, schedules } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Thiếu tên lớp học" });
    }

    const createdId = await createClass({ id, name, startTime, endTime, room, schedules });
    res.json({ success: true, id: createdId });
  } catch (err) {
    next(err);
  }
}

export async function updateClassHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { name, startTime, endTime, room, schedules } = req.body;

    const success = await updateClass(id, { name, startTime, endTime, room, schedules });
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy lớp học" });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteClassHandler(req, res, next) {
  try {
    const { id } = req.params;
    const success = await deleteClass(id);
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy lớp học" });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getClassStudentsHandler(req, res, next) {
  try {
    const { classId } = req.params;
    const { slotId } = req.query;
    const data = await getStudentsByClassId(classId, slotId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
