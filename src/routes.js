import { Router } from "express";
import authRoutes from "./features/auth/auth.routes.js";
import classesRoutes from "./features/classes/classes.routes.js";
import studentsRoutes from "./features/students/students.routes.js";
import attendanceRoutes from "./features/attendance/attendance.routes.js";
import checkinRoutes from "./features/checkin/checkin.routes.js";
import scoresRoutes from "./features/scores/scores.routes.js";
import lessonProgressRoutes from "./features/lesson-progress/lessonProgress.routes.js";
import monthlySummaryRoutes from "./features/monthly-summary/monthlySummary.routes.js";
import driveRoutes from "./features/drive/drive.routes.js";
import notificationRoutes from "./features/notifications/notification.routes.js";
import { getMonthlySummaryLiveHandler } from "./features/monthly-summary/monthlySummary.controller.js";

const apiRouter = Router();

// Gắn các routes theo tính năng
apiRouter.use("/", authRoutes);
apiRouter.use("/classes", classesRoutes);
apiRouter.use("/students", studentsRoutes);
apiRouter.use("/", attendanceRoutes);
apiRouter.use("/", checkinRoutes);
apiRouter.use("/scores", scoresRoutes);
apiRouter.use("/lesson-progress", lessonProgressRoutes);
apiRouter.use("/monthly-summary", monthlySummaryRoutes);
apiRouter.get("/monthly-summary-live", getMonthlySummaryLiveHandler); // Đảm bảo tương thích tuyệt đối
apiRouter.use("/", driveRoutes);
apiRouter.use("/", notificationRoutes);

export default apiRouter;
