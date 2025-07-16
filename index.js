import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const app = express();
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://trackerstudent.netlify.app"
  ],
  credentials: true
}));
app.use(express.json());

// Middleware log request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body || {}).length > 0) {
    console.log("  Body:", req.body);
  }
  if (Object.keys(req.query || {}).length > 0) {
    console.log("  Query:", req.query);
  }
  if (Object.keys(req.params || {}).length > 0) {
    console.log("  Params:", req.params);
  }
  next();
});

const PORT = process.env.PORT || 3001;
const SHEET_ID = process.env.SHEET_ID;

// Google Sheets API setup
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "{}"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// Helper: get data from any sheet
async function getSheetData(sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: sheetName,
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] || ""));
    return obj;
  });
}

// Hàm format timestamp về DD/MM/YYYY HH:mm:ss (giờ Việt Nam)
function formatTimestampVN(date = new Date()) {
  const d = new Date(date.getTime() + 7 * 60 * 60 * 1000); // UTC+7
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${min}:${sec}`;
}

// API: /api/login (luôn dùng sheet 'accounts')
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Thiếu thông tin" });
  try {
    const accounts = await getSheetData("accounts");
    const user = accounts.find(acc => acc.username === username && acc.password === password);
    if (!user) return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    // Trả về đầy đủ thông tin user
    res.json({ user });
  } catch (err) {
    console.error("[ERROR] /api/login:", err);
    res.status(500).json({ error: "Lỗi server hoặc Google Sheet" });
  }
});

// API: Cập nhật thông tin user (username, FullName, CustomTitle, password)
app.post("/api/users/update", async (req, res) => {
  try {
    const { username, field, value } = req.body;
    if (!username || !field) return res.status(400).json({ error: "Thiếu thông tin" });
    const accounts = await getSheetData("accounts");
    const rowIndex = accounts.findIndex(acc => acc.username === username);
    if (rowIndex === -1) return res.status(404).json({ error: "Không tìm thấy user" });
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "accounts",
    });
    const headers = resSheet.data.values[0];
    const updated = { ...accounts[rowIndex] };
    updated[field] = value;
    // Nếu đổi username thì cập nhật cả key
    if (field === "username") updated.username = value;
    const rowValues = headers.map(h => updated[h] || "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `accounts!A${rowIndex + 2}:Z${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] /api/users/update:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật user" });
  }
});

// API: Dashboard stats
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const attendance = await getSheetData("Attendance");
    let present = 0;
    let absent = 0;
    attendance.forEach(a => {
      if (a.Date === today) {
        if (a.Status === "present") present++;
        if (a.Status === "absent") absent++;
      }
    });
    res.json({ present, absent });
  } catch (err) {
    console.error("[ERROR] /api/dashboard/stats:", err);
    res.status(500).json({ error: "Lỗi khi lấy thống kê điểm danh" });
  }
});

// API: Classes today
app.get("/api/classes/today", async (req, res) => {
  try {
    const today = new Date();
    const classes = await getSheetData("Classes");
    const students = await getSheetData("Students");
    const todayStr = today.toISOString().split("T")[0];
    const todayClasses = classes.filter(c => {
      if (c.Date) return c.Date === todayStr;
      return true;
    });
    const result = todayClasses.map(c => ({
      id: c["Class ID"] || c.ID || c.Id || c.id,
      name: c.Name || c.name,
      startTime: c["Start Time"] || c.startTime,
      endTime: c["End Time"] || c.endTime,
      isActive: true,
      studentsCount: students.filter(s => {
        const classIds = (s["Class ID"] || s.classId || "").split(",").map(x => x.trim());
        return classIds.includes(c["Class ID"] || c.ID || c.Id || c.id);
      }).length,
    }));
    res.json(result);
  } catch (err) {
    console.error("[ERROR] /api/classes/today:", err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách lớp hôm nay" });
  }
});

app.post("/api/classes", async (req, res) => {
  try {
    console.log("POST /api/classes body:", req.body);
    let { id, name, startTime, endTime, room, daysOfWeek, exceptionStudents } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: "Thiếu thông tin lớp học" });
    }
    // Nếu không có id thì tự sinh mã
    if (!id) {
      id = `CLASS_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    }
    // Lưu daysOfWeek và exceptionStudents dạng JSON string
    const daysOfWeekStr = daysOfWeek ? JSON.stringify(daysOfWeek) : "";
    const exceptionStudentsStr = exceptionStudents ? JSON.stringify(exceptionStudents) : "";
    // Ghi vào Google Sheets đúng thứ tự cột
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Classes",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[id, name, startTime, endTime, room || "", daysOfWeekStr, exceptionStudentsStr, "TRUE"]],
      },
    });
    res.json({ success: true, id });
  } catch (err) {
    console.error("[ERROR] /api/classes:", err);
    res.status(500).json({ error: "Lỗi khi tạo lớp học" });
  }
});

app.get("/api/classes", async (req, res) => {
  try {
    const classes = await getSheetData("Classes");
    console.log("[DEBUG] Raw classes from sheet:", classes);
    const mapped = classes.map(item => ({
      ...item,
      id: item["Class ID"] || item.ID || item.Id || item.id,
      daysOfWeek: item.DaysOfWeek ? JSON.parse(item.DaysOfWeek) : [],
      exceptionStudents: item.ExceptionStudents ? JSON.parse(item.ExceptionStudents) : {},
    }));
    res.json(mapped);
  } catch (err) {
    console.error("[ERROR] /api/classes:", err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách lớp" });
  }
});

// API cập nhật lớp học
app.patch("/api/classes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startTime, endTime, room, daysOfWeek, exceptionStudents } = req.body;
    // Lấy dữ liệu hiện tại
    const classes = await getSheetData("Classes");
    const rowIndex = classes.findIndex(
      c => c["Class ID"] === id || c.ID === id || c.Id === id || c.id === id
    );
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy lớp học" });
    }
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Classes",
    });
    const headers = resSheet.data.values[0];
    // Chuẩn bị giá trị mới
    const updated = { ...classes[rowIndex] };
    if (name !== undefined) updated.Name = name;
    if (startTime !== undefined) updated["Start Time"] = startTime;
    if (endTime !== undefined) updated["End Time"] = endTime;
    if (room !== undefined) updated.Room = room;
    if (daysOfWeek !== undefined) updated.DaysOfWeek = JSON.stringify(daysOfWeek);
    if (exceptionStudents !== undefined) updated.ExceptionStudents = JSON.stringify(exceptionStudents);
    // Tạo mảng giá trị đúng thứ tự cột
    const rowValues = headers.map(h => updated[h] || "");
    // Ghi đè lại dòng trong sheet (rowIndex + 2 vì header là dòng 1)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Classes!A${rowIndex + 2}:Z${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] PATCH /api/classes/:id:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật lớp học" });
  }
});

// DELETE class
app.delete("/api/classes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const classes = await getSheetData("Classes");
    const rowIndex = classes.findIndex(
      c => c["Class ID"] === id || c.ID === id || c.Id === id || c.id === id
    );
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy lớp học" });
    }
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Classes",
    });
    const headers = resSheet.data.values[0];
    const emptyRow = headers.map(() => "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Classes!A${rowIndex + 2}:Z${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [emptyRow] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] DELETE /api/classes/:id:", err);
    res.status(500).json({ error: "Lỗi khi xoá lớp học" });
  }
});

// Lấy danh sách học sinh của một lớp
app.get("/api/classes/:classId/students", async (req, res) => {
  try {
    const students = await getSheetData("Students");
    const classId = req.params.classId;
    const filtered = students.filter(s => {
      const classIds = (s["Class ID"] || s.classId || "").split(",").map(x => x.trim());
      return classIds.includes(classId);
    });
    res.json(filtered);
  } catch (err) {
    console.error("[ERROR] /api/classes/:classId/students:", err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách học sinh" });
  }
});

// Thêm học sinh mới
app.post("/api/students", async (req, res) => {
  try {
    let { studentId, name, grade, email, classId } = req.body;
    if (!name || !classId) {
      return res.status(400).json({ error: "Thiếu thông tin học sinh" });
    }
    // Nếu không có studentId thì tự sinh mã
    if (!studentId) {
      studentId = `STU_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    }
    // Nếu không có grade thì để trống
    grade = grade || "";
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Students",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[studentId, name, grade, email || "", classId]],
      },
    });
    res.json({ success: true, studentId });
  } catch (err) {
    console.error("[ERROR] /api/students:", err);
    res.status(500).json({ error: "Lỗi khi thêm học sinh" });
  }
});

// API cập nhật học sinh (gán thêm classId)
app.patch("/api/students/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { classId } = req.body;
    if (!classId) return res.status(400).json({ error: "Thiếu classId" });
    // Lấy dữ liệu hiện tại
    const students = await getSheetData("Students");
    const rowIndex = students.findIndex(s => s["Student ID"] === studentId || s.studentId === studentId || s["Mã học sinh"] === studentId);
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy học sinh" });
    }
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Students",
    });
    const headers = resSheet.data.values[0];
    // Chuẩn bị giá trị mới
    const updated = { ...students[rowIndex] };
    // Xử lý trường Class ID (có thể là "Class ID" hoặc classId)
    let current = updated["Class ID"] || updated.classId || "";
    let arr = current.split(",").map(x => x.trim()).filter(Boolean);
    if (!arr.includes(classId)) arr.push(classId);
    updated["Class ID"] = arr.join(",");
    // Tạo mảng giá trị đúng thứ tự cột
    const rowValues = headers.map(h => updated[h] || "");
    // Ghi đè lại dòng trong sheet (rowIndex + 2 vì header là dòng 1)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Students!A${rowIndex + 2}:Z${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] PATCH /api/students/:studentId:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật học sinh" });
  }
});

// PATCH student (sửa thông tin học sinh)
app.patch("/api/students/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { name, grade, email, classId } = req.body;
    const students = await getSheetData("Students");
    const rowIndex = students.findIndex(s => s["Student ID"] === studentId || s.studentId === studentId || s["Mã học sinh"] === studentId);
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy học sinh" });
    }
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Students",
    });
    const headers = resSheet.data.values[0];
    // Chuẩn bị giá trị mới
    const updated = { ...students[rowIndex] };
    if (name !== undefined) updated.Name = name;
    if (grade !== undefined) updated.Grade = grade;
    if (email !== undefined) updated.Email = email;
    if (classId !== undefined) updated["Class ID"] = classId;
    const rowValues = headers.map(h => updated[h] || "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Students!A${rowIndex + 2}:Z${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] PATCH /api/students/:studentId:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật học sinh" });
  }
});

// DELETE student
app.delete("/api/students/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const students = await getSheetData("Students");
    const rowIndex = students.findIndex(s => s["Student ID"] === studentId || s.studentId === studentId || s["Mã học sinh"] === studentId);
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy học sinh" });
    }
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Students",
    });
    const headers = resSheet.data.values[0];
    const emptyRow = headers.map(() => "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Students!A${rowIndex + 2}:Z${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [emptyRow] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] DELETE /api/students/:studentId:", err);
    res.status(500).json({ error: "Lỗi khi xoá học sinh" });
  }
});

// API: Lấy toàn bộ học sinh
app.get("/api/students", async (req, res) => {
  try {
    const students = await getSheetData("Students");
    res.json(students);
  } catch (err) {
    console.error("[ERROR] /api/students:", err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách học sinh" });
  }
});

// Ghi điểm danh (upsert)
app.post("/api/attendance", async (req, res) => {
  try {
    const { studentId, studentName, classId, className, date, status, note } = req.body;
    if (!studentId || !studentName || !classId || !className || !date || !status) {
      return res.status(400).json({ error: "Thiếu thông tin điểm danh" });
    }
    // Lấy dữ liệu attendance hiện tại
    const attendance = await getSheetData("Attendance");
    const rowIndex = attendance.findIndex(a => a["Student ID"] == studentId && a["Class ID"] == classId && a["Date"] == date);
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Attendance",
    });
    const headers = resSheet.data.values[0];
    if (rowIndex !== -1) {
      // Nếu đã có, update bản ghi
      const updated = { ...attendance[rowIndex] };
      updated["Status"] = status;
      updated["Note"] = note || "";
      updated["timestamp"] = formatTimestampVN();
      // Nếu có các trường khác muốn update thì thêm vào đây
      const rowValues = headers.map(h => updated[h] || "");
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Attendance!A${rowIndex + 2}:Z${rowIndex + 2}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowValues] },
      });
      return res.json({ success: true, updated: true });
    } else {
      // Nếu chưa có, thêm mới
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "Attendance",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[studentId, studentName, classId, className, date, status, note || "", formatTimestampVN()]],
        },
      });
      return res.json({ success: true, created: true });
    }
  } catch (err) {
    console.error("[ERROR] /api/attendance:", err);
    res.status(500).json({ error: "Lỗi khi ghi điểm danh" });
  }
});

// Lấy điểm danh của lớp theo ngày
app.get("/api/attendance/:classId/:date", async (req, res) => {
  try {
    const { classId, date } = req.params;
    const attendance = await getSheetData("Attendance");
    // Hàm chuẩn hóa ngày về dạng YYYY-MM-DD
    function normalizeDate(d) {
      if (!d) return "";
      d = d.trim().replace(/\//g, "-");
      // Nếu là DD-MM-YYYY thì chuyển về YYYY-MM-DD
      const parts = d.split("-");
      if (parts.length === 3 && parts[2].length === 4 && parts[0].length === 2) {
        // DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return d;
    }
    // Log dữ liệu thực tế
    attendance.forEach(a => {
      console.log('[DEBUG] Attendance row:', a["Class ID"], a.Date, '->', normalizeDate(a.Date));
    });
    const normDate = normalizeDate(date);
    const filtered = attendance.filter(a =>
      (a["Class ID"] == classId) && normalizeDate(a.Date) == normDate
    );
    res.json(filtered);
  } catch (err) {
    console.error("[ERROR] /api/attendance/:classId/:date:", err);
    res.status(500).json({ error: "Lỗi khi lấy điểm danh" });
  }
});

// API: Lấy toàn bộ điểm danh
app.get("/api/attendance", async (req, res) => {
  try {
    const attendance = await getSheetData("Attendance");
    res.json(attendance);
  } catch (err) {
    console.error("[ERROR] /api/attendance:", err);
    res.status(500).json({ error: "Lỗi khi lấy dữ liệu điểm danh" });
  }
});

// PATCH attendance (sửa trạng thái/note)
app.patch("/api/attendance/:attendanceId", async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { status, note } = req.body;
    // attendanceId có thể là tổ hợp studentId_classId_date
    const [studentId, classId, date] = attendanceId.split("_");
    const attendance = await getSheetData("Attendance");
    const rowIndex = attendance.findIndex(a => a["Student ID"] == studentId && a["Class ID"] == classId && a["Date"] == date);
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm danh" });
    }
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Attendance",
    });
    const headers = resSheet.data.values[0];
    // Chuẩn bị giá trị mới
    const updated = { ...attendance[rowIndex] };
    if (status !== undefined) updated.Status = status;
    if (note !== undefined) updated.Note = note;
    // Tạo mảng giá trị đúng thứ tự cột
    const rowValues = headers.map(h => updated[h] || "");
    // Ghi đè lại dòng trong sheet (rowIndex + 2 vì header là dòng 1)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Attendance!A${rowIndex + 2}:Z${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] PATCH /api/attendance/:attendanceId:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật điểm danh" });
  }
});

// DELETE attendance (xoá bản ghi)
app.delete("/api/attendance/:attendanceId", async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const [studentId, classId, date] = attendanceId.split("_");
    const attendance = await getSheetData("Attendance");
    const rowIndex = attendance.findIndex(a => a["Student ID"] == studentId && a["Class ID"] == classId && a["Date"] == date);
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm danh" });
    }
    // Xoá dòng trong sheet (bằng cách ghi rỗng toàn bộ dòng)
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Attendance",
    });
    const headers = resSheet.data.values[0];
    const emptyRow = headers.map(() => "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Attendance!A${rowIndex + 2}:Z${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [emptyRow] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] DELETE /api/attendance/:attendanceId:", err);
    res.status(500).json({ error: "Lỗi khi xoá điểm danh" });
  }
});

// Lấy time slot của trợ giảng (không cần dayOfWeek)
app.get("/api/checkin-time", async (req, res) => {
  try {
    const { username } = req.query;
    const slots = await getSheetData("CheckInTime");
    let filtered = slots;
    if (username) filtered = filtered.filter(s => !s.username || s.username === username);
    // Nếu có username thì lấy slot của user đó + slot chung (username rỗng)
    filtered = filtered.map(s => ({
      ...s,
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.label
    }));
    res.json(filtered);
  } catch (err) {
    console.error("[ERROR] /api/checkin-time:", err);
    res.status(500).json({ error: "Lỗi khi lấy time slot" });
  }
});

// Ghi log checkin
app.post("/api/checkin-log", async (req, res) => {
  try {
    const { username, date, startTime, endTime, slotLabel, totalHours } = req.body;
    if (!username || !date || !startTime || !endTime) {
      return res.status(400).json({ error: "Thiếu thông tin checkin" });
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "CheckInLog",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[username, date, startTime, endTime, slotLabel || "", totalHours || "", formatTimestampVN()]],
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] /api/checkin-log:", err);
    res.status(500).json({ error: "Lỗi khi ghi log checkin" });
  }
});

// Lấy log checkin của trợ giảng theo tháng
app.get("/api/checkin-log", async (req, res) => {
  try {
    const { username, month } = req.query; // month: "2025-07"
    const logs = await getSheetData("CheckInLog");
    let filtered = logs;
    if (username) filtered = filtered.filter(l => l.username === username);
    if (month) filtered = filtered.filter(l => l.date && l.date.startsWith(month));
    res.json(filtered);
  } catch (err) {
    console.error("[ERROR] /api/checkin-log (GET):", err);
    res.status(500).json({ error: "Lỗi khi lấy log checkin" });
  }
});

app.get("/", (req, res) => {
  res.send("Student Tracker API running!");
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
}); 