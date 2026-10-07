import {
  getAllLeaves,
  createLeave,
  updateLeaveById,
  deleteLeaveById,
} from "./leaves.service.js";

export async function getLeavesHandler(req, res, next) {
  try {
    const { studentId, classId, date, status } = req.query;
    const leaves = await getAllLeaves({ studentId, classId, date, status });
    res.json(leaves);
  } catch (err) {
    next(err);
  }
}

export async function createLeaveHandler(req, res, next) {
  try {
    const { studentId, leaveDate } = req.body;
    if (!studentId || !leaveDate) {
      return res.status(400).json({ error: "Missing required fields: studentId, leaveDate" });
    }
    const created = await createLeave(req.body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function updateLeaveHandler(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await updateLeaveById(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Leave request not found" });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteLeaveHandler(req, res, next) {
  try {
    const { id } = req.params;
    const success = await deleteLeaveById(id);
    if (!success) {
      return res.status(404).json({ error: "Leave request not found" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
