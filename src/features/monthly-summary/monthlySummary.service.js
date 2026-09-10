import {
  getSheetData,
  getSheetHeaders,
  appendSheetRows,
  updateSheetRow,
  clearSheetRow,
} from "../../common/sheets.dao.js";

export async function getMonthlySummary({ classId, month, username }) {
  const data = await getSheetData("MonthlySummary");
  let filtered = data;
  if (classId) filtered = filtered.filter(s => String(s["Class ID"]) === String(classId));
  if (month) filtered = filtered.filter(s => String(s["Month"]) === String(month));
  if (username) filtered = filtered.filter(s => String(s["Username"]) === String(username));
  return filtered;
}

export async function createMonthlySummary({
  studentId,
  classId,
  month,
  examScore,
  attendanceScore,
  note,
  finalScore,
  username,
}) {
  await appendSheetRows("MonthlySummary", [
    [
      studentId,
      classId,
      month,
      examScore,
      attendanceScore,
      note || "",
      finalScore || "",
      username || "",
    ],
  ]);
  return true;
}

export async function updateMonthlySummaryByIndex(rowIndex, { examScore, attendanceScore, note, finalScore }) {
  const data = await getSheetData("MonthlySummary");
  if (!data[rowIndex]) return false;

  const headers = await getSheetHeaders("MonthlySummary");
  const updated = { ...data[rowIndex] };
  if (examScore !== undefined) updated["Exam Score"] = examScore;
  if (attendanceScore !== undefined) updated["Attendance Score"] = attendanceScore;
  if (note !== undefined) updated["Note"] = note;
  if (finalScore !== undefined) updated["Final Score"] = finalScore;

  const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
  await updateSheetRow("MonthlySummary", rowIndex, rowValues);
  return true;
}

export async function deleteMonthlySummaryByIndex(rowIndex) {
  const headers = await getSheetHeaders("MonthlySummary");
  await clearSheetRow("MonthlySummary", rowIndex, headers.length);
  return true;
}

export async function calculateMonthlySummaryLive(classId, month) {
  const [classes, students, scores, attendance, monthlySummaries] = await Promise.all([
    getSheetData("Classes"),
    getSheetData("Students"),
    getSheetData("Scores"),
    getSheetData("AttendanceCriteria"),
    getSheetData("MonthlySummary"),
  ]);

  const findClassId = row => row["Class ID"] || row.ID || row.Id || row.id;
  const classRow = classes.find(c => String(findClassId(c)) === String(classId));
  const groupId = classRow && (classRow["Group ID"] || classRow.groupId);
  const effectiveClassIds = groupId
    ? classes
        .filter(c => String(c["Group ID"] || c.groupId) === String(groupId))
        .map(c => String(findClassId(c)))
    : [String(classId)];

  const noteKey = (sid, cid, m) => `${String(sid)}__${String(cid)}__${String(m)}`;
  const noteMap = new Map();
  for (const row of monthlySummaries) {
    const sid = row["Student ID"] || row.studentId;
    const cid = row["Class ID"] || row.classId;
    const m = row["Month"] || row.month;
    if (sid && cid && m) {
      noteMap.set(noteKey(sid, cid, m), row["Note"] || row.note || "");
    }
  }

  const classStudents = students.filter(s => {
    const classIds = String(s["Class ID"] || s.classId || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
    return classIds.some(cid => effectiveClassIds.includes(String(cid)));
  });

  const result = [];
  for (const stu of classStudents) {
    const studentId = stu["Student ID"] || stu.studentId || stu.id;
    if (!studentId) continue;

    // Điểm thi trong tháng
    const scoreRows = scores.filter(
      s =>
        String(s["studentId"] || s["Student ID"]) === String(studentId) &&
        effectiveClassIds.includes(String(s["classId"] || s["Class ID"])) &&
        String(s["month"] || s["Month"]) === String(month)
    );
    const examValues = scoreRows
      .map(r => Number(r["score"] || r["Score"] || 0))
      .filter(n => Number.isFinite(n));
    const examScore = examValues.length > 0 ? Math.max(...examValues) : 0;

    // Điểm đánh giá theo buổi
    const attRows = attendance.filter(
      a =>
        String(a["Student ID"]) === String(studentId) &&
        effectiveClassIds.includes(String(a["Class ID"])) &&
        String(a["Date"] || "").startsWith(String(month))
    );
    let attendanceScore = 0;
    if (attRows.length > 0) {
      const total = attRows.reduce((sum, a) => sum + parseFloat(a["TotalScore"] || 0), 0);
      attendanceScore = total / attRows.length;
    }

    const finalScore = ((examScore + attendanceScore) / 3).toFixed(1);
    let note = noteMap.get(noteKey(studentId, classId, month)) || "";
    if (!note) {
      for (const cid of effectiveClassIds) {
        const n = noteMap.get(noteKey(studentId, cid, month));
        if (n) {
          note = n;
          break;
        }
      }
    }

    result.push({
      "Student ID": String(studentId),
      "Class ID": groupId ? String(groupId) : String(classId),
      ...(groupId ? { "Group ID": String(groupId), "Merged Class IDs": effectiveClassIds } : {}),
      Month: String(month),
      "Exam Score": Number.isFinite(examScore) ? Number(examScore.toFixed(1)) : 0,
      "Attendance Score": Number.isFinite(attendanceScore) ? Number(attendanceScore.toFixed(1)) : 0,
      Note: note,
      "Final Score": finalScore,
    });
  }

  // Xếp hạng học sinh
  const sorted = [...result].sort((a, b) => {
    const af = parseFloat(a["Final Score"] || 0);
    const bf = parseFloat(b["Final Score"] || 0);
    if (bf !== af) return bf - af;
    const ae = parseFloat(a["Exam Score"] || 0);
    const be = parseFloat(b["Exam Score"] || 0);
    return be - ae;
  });

  let prevScore = null;
  let prevRank = 0;
  sorted.forEach((row, idx) => {
    const score = parseFloat(row["Final Score"] || 0);
    const rank = score === prevScore ? prevRank : idx + 1;
    row.Rank = rank;
    prevScore = score;
    prevRank = rank;
  });

  const rankById = new Map(sorted.map(r => [String(r["Student ID"]), r.Rank]));
  result.forEach(r => {
    r.Rank = rankById.get(String(r["Student ID"])) || null;
  });

  return result;
}

export async function materializeMonthlySummary(classId, month) {
  const [classes, students, scores, attendance, existingSummary] = await Promise.all([
    getSheetData("Classes"),
    getSheetData("Students"),
    getSheetData("Scores"),
    getSheetData("AttendanceCriteria"),
    getSheetData("MonthlySummary"),
  ]);

  const findClassId = row => row["Class ID"] || row.ID || row.Id || row.id;
  const classRow = classes.find(c => String(findClassId(c)) === String(classId));
  const groupId = classRow && (classRow["Group ID"] || classRow.groupId);
  const effectiveClassIds = groupId
    ? classes
        .filter(c => String(c["Group ID"] || c.groupId) === String(groupId))
        .map(c => String(findClassId(c)))
    : [String(classId)];

  const classStudents = students.filter(s => {
    const classIds = String(s["Class ID"] || s.classId || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
    return classIds.some(cid => effectiveClassIds.includes(String(cid)));
  });

  const results = [];
  for (const stu of classStudents) {
    const studentId = stu["Student ID"] || stu.studentId || stu.id;
    if (!studentId) continue;

    const scoreRows = scores.filter(
      s =>
        String(s["studentId"] || s["Student ID"]) === String(studentId) &&
        effectiveClassIds.includes(String(s["classId"] || s["Class ID"])) &&
        String(s["month"] || s["Month"]) === String(month)
    );
    const examValues = scoreRows
      .map(r => Number(r["score"] || r["Score"] || 0))
      .filter(n => Number.isFinite(n));
    const examScore = examValues.length > 0 ? Math.max(...examValues) : 0;

    const attRows = attendance.filter(
      a =>
        String(a["Student ID"]) === String(studentId) &&
        effectiveClassIds.includes(String(a["Class ID"])) &&
        String(a["Date"] || "").startsWith(String(month))
    );
    let attendanceScore = 0;
    if (attRows.length > 0) {
      const total = attRows.reduce((sum, a) => sum + parseFloat(a["TotalScore"] || 0), 0);
      attendanceScore = total / attRows.length;
    }
    const finalScore = ((examScore + attendanceScore) / 3).toFixed(1);
    results.push({
      studentId: String(studentId),
      classId: String(classId),
      month: String(month),
      examScore,
      attendanceScore: Number(attendanceScore.toFixed(1)),
      finalScore,
    });
  }

  const headers = await getSheetHeaders("MonthlySummary", [
    "Student ID", "Class ID", "Month", "Exam Score", "Attendance Score", "Note", "Final Score", "Username"
  ]);

  let updated = 0;
  let appended = 0;
  const indexByKey = new Map();
  for (let i = 0; i < existingSummary.length; i++) {
    const r = existingSummary[i];
    const key = `${r["Student ID"]}__${r["Class ID"]}__${r["Month"]}`;
    indexByKey.set(key, i);
  }

  for (const row of results) {
    const key = `${row.studentId}__${row.classId}__${row.month}`;
    const existingIndex = indexByKey.get(key);

    if (existingIndex !== undefined) {
      const updatedObj = { ...existingSummary[existingIndex] };
      updatedObj["Exam Score"] = row.examScore;
      updatedObj["Attendance Score"] = row.attendanceScore;
      updatedObj["Final Score"] = row.finalScore;

      const rowValues = headers.map(h => {
        if (h === "Student ID") return row.studentId;
        if (h === "Class ID") return row.classId;
        if (h === "Group ID") return groupId ? String(groupId) : "";
        if (h === "Merged Class IDs") return groupId ? effectiveClassIds.join(",") : "";
        if (h === "Month") return row.month;
        if (h === "Exam Score") return row.examScore;
        if (h === "Attendance Score") return row.attendanceScore;
        if (h === "Final Score") return row.finalScore;
        return updatedObj[h] || "";
      });

      await updateSheetRow("MonthlySummary", existingIndex, rowValues);
      updated++;
    } else {
      const rowValues = headers.map(h => {
        if (h === "Student ID") return row.studentId;
        if (h === "Class ID") return row.classId;
        if (h === "Group ID") return groupId ? String(groupId) : "";
        if (h === "Merged Class IDs") return groupId ? effectiveClassIds.join(",") : "";
        if (h === "Month") return row.month;
        if (h === "Exam Score") return row.examScore;
        if (h === "Attendance Score") return row.attendanceScore;
        if (h === "Final Score") return row.finalScore;
        return "";
      });

      await appendSheetRows("MonthlySummary", [rowValues]);
      appended++;
    }
  }

  return { success: true, updated, appended, total: results.length };
}
