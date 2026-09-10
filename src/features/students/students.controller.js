import {
  getAllStudents,
  createStudent,
  addStudentToClass,
  removeStudentFromClass,
  updateStudent,
  deleteStudent,
} from "./students.service.js";

export async function getAllStudentsHandler(req, res, next) {
  try {
    const data = await getAllStudents();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createStudentHandler(req, res, next) {
  try {
    const { studentId, name, grade, email, classId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Họ và tên học sinh là bắt buộc" });
    }

    const createdId = await createStudent({
      studentId: studentId?.trim(),
      name: name.trim(),
      grade: grade?.trim() || "",
      email: email?.trim() || "",
      classId: classId ? String(classId).trim() : "",
    });
    res.json({ success: true, studentId: createdId });
  } catch (err) {
    next(err);
  }
}

export async function updateStudentHandler(req, res, next) {
  try {
    const { studentId } = req.params;
    const { classId, name, grade, email } = req.body;

    // Nếu chỉ truyền classId để gán vào lớp
    if (classId && name === undefined && grade === undefined && email === undefined) {
      const success = await addStudentToClass(studentId, classId);
      if (!success) {
        return res.status(404).json({ error: "Không tìm thấy học sinh" });
      }
      return res.json({ success: true });
    }

    // Nếu cập nhật nhiều thông tin
    const success = await updateStudent(studentId, { name, grade, email, classId });
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy học sinh" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function removeStudentFromClassHandler(req, res, next) {
  try {
    const { studentId, classId } = req.params;
    const success = await removeStudentFromClass(studentId, classId);
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy học sinh" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteStudentHandler(req, res, next) {
  try {
    const { studentId } = req.params;
    const success = await deleteStudent(studentId);
    if (!success) {
      return res.status(404).json({ error: "Không tìm thấy học sinh" });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
