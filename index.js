import app from "./src/app.js";
import { ENV } from "./src/config/env.js";
import { initReminderCronJobs } from "./src/cron/reminder.cron.js";

// Khởi chạy các tác vụ nền (Cron Jobs)
initReminderCronJobs();

// Khởi chạy HTTP server
const server = app.listen(ENV.PORT, () => {
  console.log(`[SERVER] API server running on port ${ENV.PORT}`);
  console.log(`[SERVER] Ready for production node server deployment`);
});

// Xử lý bắt lỗi tiến trình để tránh crash server ngoài ý muốn
process.on("unhandledRejection", (reason, promise) => {
  console.error("[PROCESS] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[PROCESS] Uncaught Exception thrown:", err);
});

export default app;