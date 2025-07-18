import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import multer from "multer";
import streamifier from "streamifier";
import fs from "fs";
import nodemailer from "nodemailer";
import cron from "node-cron";
import admin from "firebase-admin";
// Xoá dòng import serviceAccount
// import serviceAccount from "./student-tracker-7afed-firebase-adminsdk-fbsvc-ff9e706a85.json" assert { type: "json" };

// Đọc từng service account từ biến môi trường
const serviceAccountSheets = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_SHEETS);
const serviceAccountDrive = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_DRIVE);
const serviceAccountFirebase = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_FIREBASE);

// Khởi tạo Firebase Admin với service account riêng
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountFirebase),
});

dotenv.config();

const app = express();
app.use(cors({
  origin: [
    "http://localhost:5174",
    "https://trackerstudent.netlify.app"
  ],
  credentials: true
}));
app.use(express.json());

// Middleware log request
app.use((req, res, next) => {
  // console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body || {}).length > 0) {
    // console.log("  Body:", req.body);
  }
  if (Object.keys(req.query || {}).length > 0) {
    // console.log("  Query:", req.query);
  }
  if (Object.keys(req.params || {}).length > 0) {
    // console.log("  Params:", req.params);
  }
  next();
});

const PORT = process.env.PORT || 3001;
const SHEET_ID = process.env.SHEET_ID;

// Google Sheets API setup với service account riêng
const authSheets = new google.auth.GoogleAuth({
  credentials: serviceAccountSheets,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth: authSheets });

// Đọc credentials và token cho Google Drive OAuth2
const credentials = JSON.parse(process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS);
const { client_id, client_secret, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);
const token = JSON.parse(process.env.GOOGLE_DRIVE_OAUTH_TOKEN);
oAuth2Client.setCredentials(token);
const drive = google.drive({ version: "v3", auth: oAuth2Client });

// Multer setup để nhận multipart/form-data
const upload = multer({ storage: multer.memoryStorage() });

// Helper: get data from any sheet
async function getSheetData(sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: sheetName,
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] || ""));
    return obj;
  });
}

// Hàm format timestamp về DD/MM/YYYY HH:mm:ss (giờ Việt Nam)
function formatTimestampVN(date = new Date()) {
  const d = new Date(date); // KHÔNG cộng thêm 7 tiếng nữa
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${min}:${sec}`;
}

// Hàm gửi email
async function sendMail({ to, subject, text, html }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
  console.log("SendMail result:", info);
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
    const attendance = await getSheetData("AttendanceCriteria");
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
      room: c["Room"] || c.room,
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

// API tạo lớp học
app.post("/api/classes", async (req, res) => {
  try {
    // console.log("POST /api/classes body:", req.body);
    let { id, name, startTime, endTime, room } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: "Thiếu thông tin lớp học" });
    }
    // Nếu không có id thì tự sinh mã
    if (!id) {
      id = `CLASS_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    }
    // Ghi vào Google Sheets đúng thứ tự cột
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Classes",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[id, name, startTime, endTime, room || "", "", "", "TRUE"]],
      },
    });
    res.json({ success: true, id });
  } catch (err) {
    console.error("[ERROR] /api/classes:", err);
    res.status(500).json({ error: "Lỗi khi tạo lớp học" });
  }
});

// API lấy danh sách lớp
app.get("/api/classes", async (req, res) => {
  try {
    const classes = await getSheetData("Classes");
    // console.log("[DEBUG] Raw classes from sheet:", classes);
    const mapped = classes.map(item => ({
      ...item,
      id: item["Class ID"] || item.ID || item.Id || item.id,
      // KHÔNG còn daysOfWeek, exceptionStudents
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
    const { name, startTime, endTime, room } = req.body;
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
    // KHÔNG còn daysOfWeek, exceptionStudents
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

// API: Điểm danh và tiêu chí (AttendanceCriteria, merge logic cũ + mới)
app.post("/api/attendance-criteria", async (req, res) => {
  try {
    const fields = [
      "StudentID", "StudentName", "ClassID", "ClassName", "Date", "Status", "Attitude", "Homework", "Worksheet", "Notebook", "Attendance", "TotalScore", "Note", "Timestamp", "username"
    ];
    const row = fields.map(f => req.body[f] !== undefined ? req.body[f] : "");
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "AttendanceCriteria",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] POST /api/attendance-criteria:", err);
    res.status(500).json({ error: "Error saving attendance/criteria" });
  }
});

// API: Upsert attendance/criteria (update nếu có, append nếu chưa)
app.post("/api/attendance-criteria/upsert", async (req, res) => {
  try {
    const fields = [
      "Student ID", "StudentName", "Class ID", "ClassName", "Date", "Status", "Attitude", "Homework", "Worksheet", "Notebook", "TotalScore", "Note", "Timestamp", "username"
    ];
    const data = await getSheetData("AttendanceCriteria");
    const { "Student ID": studentId, "Class ID": classId, Date: date, username } = req.body;
    const idx = data.findIndex(r =>
      r["Student ID"] === studentId &&
      r["Class ID"] === classId &&
      r["Date"] === date &&
      r["username"] === username
    );
    if (idx !== -1) {
      // Update
      const resSheet = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "AttendanceCriteria" });
      const headers = resSheet.data.values[0];
      const updated = { ...data[idx] };
      for (const key in req.body) {
        if (headers.includes(key)) updated[key] = req.body[key];
      }
      const rowValues = headers.map(h => updated[h] || "");
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `AttendanceCriteria!A${idx + 2}:Z${idx + 2}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowValues] },
      });
      return res.json({ success: true, updated: true });
    } else {
      // Insert
      const row = fields.map(f => req.body[f] !== undefined ? req.body[f] : "");
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "AttendanceCriteria",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
      return res.json({ success: true, created: true });
    }
  } catch (err) {
    console.error("[ERROR] /api/attendance-criteria/upsert:", err);
    res.status(500).json({ error: "Error upserting attendance/criteria" });
  }
});

// Lấy điểm danh của lớp theo ngày, có thể lọc theo username
app.get("/api/attendance/:classId/:date", async (req, res) => {
  try {
    const { classId, date } = req.params;
    const { username } = req.query;
    const attendance = await getSheetData("AttendanceCriteria");
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
    attendance.forEach(a => {
      // console.log('[DEBUG] Attendance row:', a["Class ID"], a.Date, '->', normalizeDate(a.Date));
    });
    const normDate = normalizeDate(date);
    let filtered = attendance.filter(a =>
      (a["Class ID"] == classId) && normalizeDate(a.Date) == normDate
    );
    if (username) {
      filtered = filtered.filter(a => a.username === username);
    }
    res.json(filtered);
  } catch (err) {
    console.error("[ERROR] /api/attendance/:classId/:date:", err);
    res.status(500).json({ error: "Lỗi khi lấy điểm danh" });
  }
});

// API: Lấy toàn bộ điểm danh
app.get("/api/attendance", async (req, res) => {
  try {
    const attendance = await getSheetData("AttendanceCriteria");
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
    const attendance = await getSheetData("AttendanceCriteria");
    const rowIndex = attendance.findIndex(a => a["Student ID"] == studentId && a["Class ID"] == classId && a["Date"] == date);
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm danh" });
    }
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "AttendanceCriteria",
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
      range: `AttendanceCriteria!A${rowIndex + 2}:Z${rowIndex + 2}`,
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
    const attendance = await getSheetData("AttendanceCriteria");
    const rowIndex = attendance.findIndex(a => a["Student ID"] == studentId && a["Class ID"] == classId && a["Date"] == date);
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm danh" });
    }
    // Xoá dòng trong sheet (bằng cách ghi rỗng toàn bộ dòng)
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "AttendanceCriteria",
    });
    const headers = resSheet.data.values[0];
    const emptyRow = headers.map(() => "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `AttendanceCriteria!A${rowIndex + 2}:Z${rowIndex + 2}`,
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

// API: Quản lý điểm số học sinh
app.get("/api/scores", async (req, res) => {
  try {
    const { classId, month } = req.query;
    const scores = await getSheetData("Scores");
    let filtered = scores;
    if (classId) filtered = filtered.filter(s => String(s.classId || s["Class ID"]) === String(classId));
    if (month) filtered = filtered.filter(s => (s.month || s["Month"]) === month);
    res.json(filtered);
  } catch (err) {
    console.error("[ERROR] /api/scores:", err);
    res.status(500).json({ error: "Lỗi khi lấy điểm số" });
  }
});

app.post("/api/scores", async (req, res) => {
  try {
    const { studentId, classId, month, score, note } = req.body;
    if (!studentId || !classId || !month) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Scores",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[studentId, classId, month, score, note || ""]],
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] POST /api/scores:", err);
    res.status(500).json({ error: "Lỗi khi lưu điểm số" });
  }
});

app.patch("/api/scores/:rowIndex", async (req, res) => {
  try {
    const { rowIndex } = req.params;
    const { score, note } = req.body;
    const scores = await getSheetData("Scores");
    if (!scores[rowIndex]) return res.status(404).json({ error: "Không tìm thấy bản ghi điểm" });
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Scores",
    });
    const headers = resSheet.data.values[0];
    const updated = { ...scores[rowIndex] };
    if (score !== undefined) updated.Score = score;
    if (note !== undefined) updated.Note = note;
    const rowValues = headers.map(h => updated[h] || "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Scores!A${Number(rowIndex) + 2}:Z${Number(rowIndex) + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] PATCH /api/scores/:rowIndex:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật điểm số" });
  }
});

app.delete("/api/scores/:rowIndex", async (req, res) => {
  try {
    const { rowIndex } = req.params;
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Scores",
    });
    const headers = resSheet.data.values[0];
    const emptyRow = headers.map(() => "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Scores!A${Number(rowIndex) + 2}:Z${Number(rowIndex) + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [emptyRow] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] DELETE /api/scores/:rowIndex:", err);
    res.status(500).json({ error: "Lỗi khi xoá điểm số" });
  }
});

// API: AttendanceCriteria (điểm danh + đánh giá tiêu chí)
app.get("/api/attendance-criteria", async (req, res) => {
  try {
    const { studentId, classId, date, username } = req.query;
    const data = await getSheetData("AttendanceCriteria");
    // Nếu có đủ 4 trường, trả về rowIndex (giữ nguyên)
    if (studentId && classId && date && username) {
      const idx = data.findIndex(r =>
        (r["Student ID"] === studentId) &&
        (r["Class ID"] === classId) &&
        (r["Date"] === date) &&
        (r["username"] === username)
      );
      if (idx !== -1) return res.json({ rowIndex: idx });
      return res.json({ rowIndex: null });
    }
    // Nếu có username, chỉ trả về bản ghi của user đó
    if (username) {
      return res.json(data.filter(r => (r["username"] || "").trim() === username));
    }
    // Nếu không có username, trả về toàn bộ (chỉ dành cho admin)
    res.json(data);
  } catch (err) {
    console.error("[ERROR] /api/attendance-criteria (GET):", err);
    res.status(500).json({ error: "Error fetching attendance criteria" });
  }
});

app.patch("/api/attendance-criteria/:rowIndex", async (req, res) => {
  try {
    const { rowIndex } = req.params;
    const data = await getSheetData("AttendanceCriteria");
    if (!data[rowIndex]) return res.status(404).json({ error: "Not found" });
    const resSheet = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "AttendanceCriteria" });
    const headers = resSheet.data.values[0];
    const updated = { ...data[rowIndex] };
    for (const key in req.body) {
      if (headers.includes(key)) updated[key] = req.body[key];
    }
    const rowValues = headers.map(h => updated[h] || "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `AttendanceCriteria!A${Number(rowIndex) + 2}:Z${Number(rowIndex) + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] PATCH /api/attendance-criteria/:rowIndex:", err);
    res.status(500).json({ error: "Error updating attendance criteria" });
  }
});

app.delete("/api/attendance-criteria/:rowIndex", async (req, res) => {
  try {
    const { rowIndex } = req.params;
    const resSheet = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "AttendanceCriteria" });
    const headers = resSheet.data.values[0];
    const emptyRow = headers.map(() => "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `AttendanceCriteria!A${Number(rowIndex) + 2}:Z${Number(rowIndex) + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [emptyRow] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] DELETE /api/attendance-criteria/:rowIndex:", err);
    res.status(500).json({ error: "Error deleting attendance criteria" });
  }
});

// API: LessonProgress (ghi chú buổi học, ảnh, bài tập về nhà, lịch kiểm tra, note)
app.get("/api/lesson-progress", async (req, res) => {
  try {
    const { classId, date } = req.query;
    const data = await getSheetData("LessonProgress");
    let filtered = data;
    if (classId) filtered = filtered.filter(r => String(r.ClassID) === String(classId));
    if (date) filtered = filtered.filter(r => r.Date === date);
    res.json(filtered);
  } catch (err) {
    console.error("[ERROR] /api/lesson-progress:", err);
    res.status(500).json({ error: "Error fetching lesson progress" });
  }
});

app.post("/api/lesson-progress", async (req, res) => {
  try {
    const { Date, ClassID, LessonContent, LessonImages, HomeworkContent, HomeworkImages, HomeworkCheckDate, GeneralNote, NotificationSent } = req.body;
    if (!Date || !ClassID) return res.status(400).json({ error: "Missing required fields" });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "LessonProgress",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[Date, ClassID, LessonContent, LessonImages, HomeworkContent, HomeworkImages, HomeworkCheckDate, GeneralNote, NotificationSent || "", "", ""]], // Thêm cột Checked, Pushed
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] POST /api/lesson-progress:", err);
    res.status(500).json({ error: "Error saving lesson progress" });
  }
});

app.patch("/api/lesson-progress/:rowIndex", async (req, res) => {
  try {
    const { rowIndex } = req.params;
    const { LessonContent, LessonImages, HomeworkContent, HomeworkImages, HomeworkCheckDate, GeneralNote, NotificationSent } = req.body;
    const data = await getSheetData("LessonProgress");
    if (!data[rowIndex]) return res.status(404).json({ error: "Not found" });
    const resSheet = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "LessonProgress" });
    const headers = resSheet.data.values[0];
    const updated = { ...data[rowIndex] };
    if (LessonContent !== undefined) updated.LessonContent = LessonContent;
    if (LessonImages !== undefined) updated.LessonImages = LessonImages;
    if (HomeworkContent !== undefined) updated.HomeworkContent = HomeworkContent;
    if (HomeworkImages !== undefined) updated.HomeworkImages = HomeworkImages;
    if (HomeworkCheckDate !== undefined) updated.HomeworkCheckDate = HomeworkCheckDate;
    if (GeneralNote !== undefined) updated.GeneralNote = GeneralNote;
    if (NotificationSent !== undefined) updated.NotificationSent = NotificationSent;
    if (req.body.Checked !== undefined) updated.Checked = req.body.Checked;
    if (req.body.Pushed !== undefined) updated.Pushed = req.body.Pushed;
    const rowValues = headers.map(h => updated[h] || "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `LessonProgress!A${Number(rowIndex) + 2}:Z${Number(rowIndex) + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] PATCH /api/lesson-progress/:rowIndex:", err);
    res.status(500).json({ error: "Error updating lesson progress" });
  }
});

app.delete("/api/lesson-progress/:rowIndex", async (req, res) => {
  try {
    const { rowIndex } = req.params;
    const resSheet = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "LessonProgress" });
    const headers = resSheet.data.values[0];
    const emptyRow = headers.map(() => "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `LessonProgress!A${Number(rowIndex) + 2}:Z${Number(rowIndex) + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [emptyRow] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] DELETE /api/lesson-progress/:rowIndex:", err);
    res.status(500).json({ error: "Error deleting lesson progress" });
  }
});

// API: Tổng kết điểm tháng (MonthlySummary)
app.get("/api/monthly-summary", async (req, res) => {
  try {
    const { classId, month, username } = req.query;
    const data = await getSheetData("MonthlySummary");
    let filtered = data;
    if (classId) filtered = filtered.filter(s => String(s["Class ID"]) === String(classId));
    if (month) filtered = filtered.filter(s => String(s["Month"]) === String(month));
    if (username) filtered = filtered.filter(s => String(s["Username"]) === String(username));
    // console.log("[API] /api/monthly-summary query:", req.query);
    // console.log("[API] /api/monthly-summary headers:", Object.keys(data[0] || {}));
    // console.log("[API] /api/monthly-summary result count:", filtered.length);
    // console.log("[API] /api/monthly-summary result sample:", filtered[0]);
    res.json(filtered);
  } catch (err) {
    console.error("[ERROR] /api/monthly-summary:", err);
    res.status(500).json({ error: "Lỗi khi lấy tổng kết điểm tháng" });
  }
});

app.post("/api/monthly-summary", async (req, res) => {
  try {
    const { studentId, classId, month, examScore, attendanceScore, note, finalScore, username } = req.body;
    if (!studentId || !classId || !month) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "MonthlySummary",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[studentId, classId, month, examScore, attendanceScore, note || "", finalScore || "", username || ""]],
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] POST /api/monthly-summary:", err);
    res.status(500).json({ error: "Lỗi khi lưu tổng kết điểm tháng" });
  }
});

app.patch("/api/monthly-summary/:rowIndex", async (req, res) => {
  try {
    const { rowIndex } = req.params;
    const { examScore, attendanceScore, note, finalScore } = req.body;
    const data = await getSheetData("MonthlySummary");
    if (!data[rowIndex]) return res.status(404).json({ error: "Không tìm thấy bản ghi tổng kết" });
    // Lấy header để xác định vị trí cột
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "MonthlySummary",
    });
    const headers = resSheet.data.values[0];
    const updated = { ...data[rowIndex] };
    if (examScore !== undefined) updated["Exam Score"] = examScore;
    if (attendanceScore !== undefined) updated["Attendance Score"] = attendanceScore;
    if (note !== undefined) updated["Note"] = note;
    if (finalScore !== undefined) updated["Final Score"] = finalScore;
    const rowValues = headers.map(h => updated[h] || "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `MonthlySummary!A${Number(rowIndex) + 2}:Z${Number(rowIndex) + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] PATCH /api/monthly-summary/:rowIndex:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật tổng kết điểm tháng" });
  }
});

app.delete("/api/monthly-summary/:rowIndex", async (req, res) => {
  try {
    const { rowIndex } = req.params;
    const resSheet = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "MonthlySummary" });
    const headers = resSheet.data.values[0];
    const emptyRow = headers.map(() => "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `MonthlySummary!A${Number(rowIndex) + 2}:Z${Number(rowIndex) + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [emptyRow] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] DELETE /api/monthly-summary/:rowIndex:", err);
    res.status(500).json({ error: "Lỗi khi xoá tổng kết điểm tháng" });
  }
});

// API upload nhiều file lên Google Drive
app.post("/api/upload-drive", upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded" });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || undefined; // Nếu muốn lưu vào folder cụ thể
    const links = [];
    for (const file of req.files) {
      const driveRes = await drive.files.create({
        requestBody: {
          name: file.originalname,
          mimeType: file.mimetype,
          parents: folderId ? [folderId] : undefined,
        },
        media: {
          mimeType: file.mimetype,
          body: streamifier.createReadStream(file.buffer),
        },
        fields: "id,webViewLink,webContentLink",
      });
      // Set quyền public cho file
      await drive.permissions.create({
        fileId: driveRes.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });
      // Lấy link xem công khai
      const fileMeta = await drive.files.get({ fileId: driveRes.data.id, fields: "webViewLink,webContentLink" });
      links.push(fileMeta.data.webViewLink || fileMeta.data.webContentLink);
    }
    res.json({ links });
  } catch (err) {
    console.error("[ERROR] /api/upload-drive:", err);
    res.status(500).json({ error: "Error uploading to Google Drive" });
  }
});

// Cron job: mỗi phút kiểm tra LessonProgress để gửi email nhắc nhở trước giờ kiểm tra bài tập về nhà 10 phút
cron.schedule("* * * * *", async () => {
  try {
    const lessonProgress = await getSheetData("LessonProgress");
    const accounts = await getSheetData("accounts");
    const now = new Date();
    for (let i = 0; i < lessonProgress.length; i++) {
      const lp = lessonProgress[i];
      if (
        lp.HomeworkCheckDate &&
        lp.Checked !== "yes" &&
        lp.NotificationSent !== "yes"
      ) {
        let checkDateStr = lp.HomeworkCheckDate.replace(" ", "T");
        const checkDate = new Date(checkDateStr);
        const diff = (checkDate.getTime() - now.getTime()) / 60000;
        console.log(`[CRON] Lớp: ${lp.ClassID}, Date: ${lp.Date}, Checked: ${lp.Checked}, NotificationSent: ${lp.NotificationSent}, Còn cách trước khi gửi: ${diff}`);
        if (diff > 9 && diff <= 10) {
          // Lấy tài khoản đầu tiên có email
          const teacher = accounts.find(acc => acc.email);
          if (teacher && teacher.email) {
            await sendMail({
              to: teacher.email,
              subject: "Nhắc kiểm tra bài tập về nhà",
              text: `Bạn cần kiểm tra bài tập về nhà cho lớp ${lp.ClassID} ngày ${lp.Date}.`,
              html: `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px;">
      <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px #0001; padding: 24px;">
        <h2 style="color: #2563eb; margin-bottom: 12px;">📚 Nhắc kiểm tra bài tập về nhà</h2>
        <p style="font-size: 16px; color: #222;">
          Xin chào <b>${teacher.FullName || teacher.username || ""}</b>,
        </p>
        <p style="font-size: 16px; color: #222;">
          Bạn cần kiểm tra bài tập về nhà cho:
        </p>
        <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #555;">Lớp:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #111;">${lp.ClassID}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #555;">Ngày học:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #111;">${lp.Date}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #555;">Nội dung BTVN:</td>
            <td style="padding: 8px 0; color: #111;">${lp.HomeworkContent || "<i>Không có ghi chú</i>"}</td>
          </tr>
        </table>
        <blockquote style="border-left: 4px solid #2563eb; margin: 16px 0; padding-left: 12px; color: #2563eb;">
          <b>Thời gian kiểm tra:</b> ${lp.HomeworkCheckDate.replace('T', ' ')}
        </blockquote>
        <p style="font-size: 14px; color: #888; margin-top: 24px;">
          — Student Tracker
        </p>
      </div>
    </div>
  `,
            });
            // Đánh dấu đã gửi thông báo
            const resSheet = await sheets.spreadsheets.values.get({
              spreadsheetId: SHEET_ID,
              range: "LessonProgress",
            });
            const headers = resSheet.data.values[0];
            const updated = { ...lp, NotificationSent: "yes" };
            const rowValues = headers.map(h => updated[h] || "");
            await sheets.spreadsheets.values.update({
              spreadsheetId: SHEET_ID,
              range: `LessonProgress!A${i + 2}:Z${i + 2}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [rowValues] },
            });
            console.log(`[EMAIL] Đã gửi nhắc nhở kiểm tra BTVN cho lớp ${lp.ClassID} ngày ${lp.Date}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("[CRON EMAIL ERROR]", err);
  }
});

// Cron job: mỗi phút kiểm tra LessonProgress để gửi push notification trước giờ kiểm tra bài tập về nhà 10 phút
cron.schedule("* * * * *", async () => {
  try {
    const lessonProgress = await getSheetData("LessonProgress");
    const accounts = await getSheetData("accounts");
    const fcmTokens = await getSheetData("FCMTokens");
    const now = new Date();
    for (let i = 0; i < lessonProgress.length; i++) {
      const lp = lessonProgress[i];
      if (
        lp.HomeworkCheckDate &&
        lp.Checked !== "yes" &&
        lp.Pushed !== "yes"
      ) {
        let checkDateStr = lp.HomeworkCheckDate.replace(" ", "T");
        const checkDate = new Date(checkDateStr);
        const diff = (checkDate.getTime() - now.getTime()) / 60000;
        if (diff > 9 && diff <= 10) {
          // Lấy tất cả token từ FCMTokens
          const tokens = fcmTokens.map(row => row.token).filter(Boolean);
          if (tokens.length > 0) {
            const message = {
              notification: {
                title: "Nhắc kiểm tra bài tập về nhà",
                body: `Bạn cần kiểm tra bài tập về nhà cho lớp ${lp.ClassID} ngày ${lp.Date}.`,
              },
              tokens,
              webpush: {
                fcmOptions: {
                  link: "https://trackerstudent.netlify.app", // Link khi bấm vào notification
                },
              },
            };
            try {
              const response = await admin.messaging().sendMulticast(message);
              console.log("[PUSH] Đã gửi push notification cho lớp", lp.ClassID, "date", lp.Date, "result:", response.successCount, "/", tokens.length);
              // Đánh dấu đã push
              const resSheet = await sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: "LessonProgress",
              });
              const headers = resSheet.data.values[0];
              const updated = { ...lp, Pushed: "yes" };
              const rowValues = headers.map(h => updated[h] || "");
              await sheets.spreadsheets.values.update({
                spreadsheetId: SHEET_ID,
                range: `LessonProgress!A${i + 2}:Z${i + 2}`,
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [rowValues] },
              });
            } catch (err) {
              console.error("[PUSH ERROR]", err);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[CRON PUSH ERROR]", err);
  }
});

// Sửa endpoint /test-mail: lấy tài khoản đầu tiên có email
app.get("/test-mail", async (req, res) => {
  try {
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "OK" : "MISSING");
    console.log("EMAIL_FROM:", process.env.EMAIL_FROM);
    const accounts = await getSheetData("accounts");
    const teacher = accounts.find(acc => acc.email);
    if (!teacher || !teacher.email) {
      return res.status(404).json({ error: "Không tìm thấy email giáo viên trong sheet accounts" });
    }
    await sendMail({
      to: teacher.email,
      subject: "Test email",
      text: "Đây là email test từ hệ thống Student Tracker.",
      html: "<b>Đây là email test từ hệ thống Student Tracker.</b>",
    });
    res.json({ success: true, email: teacher.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API lưu FCM token vào Google Sheet
app.post("/api/save-fcm-token", async (req, res) => {
  try {
    const { token, username } = req.body;
    if (!token || !username) return res.status(400).json({ error: "Thiếu token hoặc username" });

    // Kiểm tra sheet FCMTokens đã có chưa, nếu chưa thì tạo mới
    // Lưu: username, token, timestamp
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "FCMTokens",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[username, token, new Date().toISOString()]],
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[ERROR] /api/save-fcm-token:", err);
    res.status(500).json({ error: "Lỗi khi lưu FCM token" });
  }
});

app.get("/", (req, res) => {
  res.send("Student Tracker API running!");
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
}); 