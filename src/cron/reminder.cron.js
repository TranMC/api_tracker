import cron from "node-cron";
import { getSheetData, getSheetHeaders, updateSheetRow } from "../common/sheets.dao.js";
import { sendMail } from "../config/mailer.js";
import { firebaseAdmin } from "../config/firebase.js";

export function initReminderCronJobs() {
  // Cron 1: Kiểm tra LessonProgress để gửi email nhắc nhở trước giờ kiểm tra bài tập về nhà 10 phút
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
          const checkDateStr = lp.HomeworkCheckDate.replace(" ", "T");
          const checkDate = new Date(checkDateStr);
          const diff = (checkDate.getTime() - now.getTime()) / 60000;

          if (diff > 9 && diff <= 10) {
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
                        <b>Thời gian kiểm tra:</b> ${lp.HomeworkCheckDate.replace("T", " ")}
                      </blockquote>
                      <p style="font-size: 14px; color: #888; margin-top: 24px;">
                        — Student Tracker
                      </p>
                    </div>
                  </div>
                `,
              });

              // Đánh dấu đã gửi thông báo
              const headers = await getSheetHeaders("LessonProgress");
              const updated = { ...lp, NotificationSent: "yes" };
              const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
              await updateSheetRow("LessonProgress", i, rowValues);
              console.log(`[EMAIL] Đã gửi nhắc nhở kiểm tra BTVN cho lớp ${lp.ClassID} ngày ${lp.Date}`);
            }
          }
        }
      }
    } catch (err) {
      console.error("[CRON EMAIL ERROR]", err);
    }
  });

  // Cron 2: Gửi Web Push Notification qua Firebase Admin trước giờ kiểm tra BTVN 10 phút
  cron.schedule("* * * * *", async () => {
    try {
      if (!firebaseAdmin) return;
      const lessonProgress = await getSheetData("LessonProgress");
      const fcmTokens = await getSheetData("FCMTokens");
      const now = new Date();

      for (let i = 0; i < lessonProgress.length; i++) {
        const lp = lessonProgress[i];
        if (
          lp.HomeworkCheckDate &&
          lp.Checked !== "yes" &&
          lp.Pushed !== "yes"
        ) {
          const checkDateStr = lp.HomeworkCheckDate.replace(" ", "T");
          const checkDate = new Date(checkDateStr);
          const diff = (checkDate.getTime() - now.getTime()) / 60000;

          if (diff > 9 && diff <= 10) {
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
                    link: "https://trackerstudent.netlify.app",
                  },
                },
              };

              try {
                const response = await firebaseAdmin.messaging().sendMulticast(message);
                console.log(
                  "[PUSH] Đã gửi push notification cho lớp",
                  lp.ClassID,
                  "date",
                  lp.Date,
                  "result:",
                  response.successCount,
                  "/",
                  tokens.length
                );

                const headers = await getSheetHeaders("LessonProgress");
                const updated = { ...lp, Pushed: "yes" };
                const rowValues = headers.map(h => (updated[h] !== undefined ? updated[h] : ""));
                await updateSheetRow("LessonProgress", i, rowValues);
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

  console.log("[CRON] Reminder background jobs initialized successfully.");
}
