import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const app = express();
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

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

// API: /api/login (luôn dùng sheet 'accounts')
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Thiếu thông tin" });
  try {
    const accounts = await getSheetData("accounts");
    const user = accounts.find(acc => acc.username === username && acc.password === password);
    if (!user) return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    // Trả về thông tin user (chỉ username và ratio)
    const { username: u, ratio } = user;
    res.json({ user: { username: u, ratio } });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server hoặc Google Sheet" });
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
    res.status(500).json({ error: "Lỗi khi lấy thống kê điểm danh" });
  }
});

// API: Classes today
app.get("/api/classes/today", async (req, res) => {
  try {
    const today = new Date();
    const classes = await getSheetData("Classes");
    const students = await getSheetData("Students");
    // Giả định cột Start Time, End Time định dạng HH:mm hoặc ISO, có cột Date hoặc lặp theo ngày trong tuần
    // Ở đây chỉ lọc theo ngày hiện tại, bạn có thể chỉnh lại logic nếu cần
    const todayStr = today.toISOString().split("T")[0];
    const todayClasses = classes.filter(c => {
      // Nếu có cột Date thì so sánh, nếu không thì trả về tất cả
      if (c.Date) return c.Date === todayStr;
      return true;
    });
    const result = todayClasses.map(c => ({
      id: c.ID || c.Id || c.id,
      name: c.Name || c.name,
      startTime: c["Start Time"] || c.startTime,
      endTime: c["End Time"] || c.endTime,
      isActive: true,
      studentsCount: students.filter(s => s["Class ID"] === c.ID || s.classId === c.ID || s.classId === c.id).length,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách lớp hôm nay" });
  }
});

app.post("/api/classes", async (req, res) => {
  try {
    console.log("POST /api/classes body:", req.body);
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
        values: [[id, name, startTime, endTime, room || "", "TRUE"]],
      },
    });
    res.json({ success: true, id });
  } catch (err) {
    console.error("Lỗi khi tạo lớp học:", err);
    res.status(500).json({ error: "Lỗi khi tạo lớp học" });
  }
});

app.get("/api/classes", async (req, res) => {
  try {
    const classes = await getSheetData("Classes");
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách lớp" });
  }
});

// Lấy danh sách học sinh của một lớp
app.get("/api/classes/:classId/students", async (req, res) => {
  try {
    const students = await getSheetData("Students");
    const classId = req.params.classId;
    const filtered = students.filter(s => s["Class ID"] == classId || s.classId == classId);
    res.json(filtered);
  } catch (err) {
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
    res.status(500).json({ error: "Lỗi khi thêm học sinh" });
  }
});

// Ghi điểm danh
app.post("/api/attendance", async (req, res) => {
  try {
    const { studentId, classId, date, status } = req.body;
    if (!studentId || !classId || !date || !status) {
      return res.status(400).json({ error: "Thiếu thông tin điểm danh" });
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Attendance",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[studentId, "", classId, "", date, status, "", new Date().toISOString()]],
      },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi ghi điểm danh" });
  }
});

// Lấy điểm danh của lớp theo ngày
app.get("/api/attendance/:classId/:date", async (req, res) => {
  try {
    const { classId, date } = req.params;
    const attendance = await getSheetData("Attendance");
    const filtered = attendance.filter(a => a["Class ID"] == classId && a.Date == date);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy điểm danh" });
  }
});

app.get("/", (req, res) => {
  res.send("Student Tracker API running!");
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
}); 