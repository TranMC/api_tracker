import cron from "node-cron";
import { getSheetData, getSheetHeaders, updateSheetRow } from "../common/sheets.dao.js";
import { sendMail } from "../config/mailer.js";
import { firebaseAdmin } from "../config/firebase.js";
import { ENV } from "../config/env.js";

export function initReminderCronJobs() {
  // Cron 1: Gửi email nhắc nhở kiểm tra BTVN (khi còn <= 10 phút hoặc quá hạn chưa quá 60 phút)
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

          // Gửi khi còn <= 10 phút hoặc mới quá hạn <= 60 phút mà chưa kịp gửi
          if (diff <= 10 && diff >= -60) {
            let targetEmail = "";
            let teacherName = "";

            const teacherWithEmail = accounts.find(acc => acc.email);
            if (teacherWithEmail && teacherWithEmail.email) {
              targetEmail = teacherWithEmail.email;
              teacherName = teacherWithEmail.FullName || teacherWithEmail.username || "";
            } else if (ENV.EMAIL_USER) {
              targetEmail = ENV.EMAIL_USER;
              teacherName = "Thầy/Cô";
            }

            if (targetEmail) {
              await sendMail({
                to: targetEmail,
                subject: `[Nhắc việc] Kiểm tra bài tập về nhà - Lớp ${lp.ClassID}`,
                text: `Bạn cần kiểm tra bài tập về nhà cho lớp ${lp.ClassID} ngày ${lp.Date}.`,
                html: `
                  <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px;">
                    <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px #0001; padding: 24px;">
                      <h2 style="color: #2563eb; margin-bottom: 12px;">📚 Nhắc kiểm tra bài tập về nhà</h2>
                      <p style="font-size: 16px; color: #222;">
                        Xin chào <b>${teacherName}</b>,
                      </p>
                      <p style="font-size: 16px; color: #222;">
                        Đã đến hạn kiểm tra bài tập về nhà:
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
                        — Hệ thống EduTrack / Student Tracker
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
              console.log(`[EMAIL] Đã gửi nhắc nhở kiểm tra BTVN cho lớp ${lp.ClassID} ngày ${lp.Date} tới ${targetEmail}`);
            }
          }
        }
      }
    } catch (err) {
      const errMsg = err?.message || err?.code || err;
      console.error(`[CRON EMAIL ERROR] ${errMsg}`);
    }
  });

  // Cron 2: Gửi Web Push Notification qua Firebase Admin khi đến hạn BTVN
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

          // Gửi khi còn <= 10 phút hoặc mới quá hạn <= 60 phút mà chưa kịp gửi
          if (diff <= 10 && diff >= -60) {
            const tokens = fcmTokens.map(row => row.token).filter(Boolean);
            if (tokens.length > 0) {
              const clientUrl = Array.isArray(ENV.CORS_ORIGINS) ? ENV.CORS_ORIGINS[0] : "http://localhost:5173";
              const message = {
                notification: {
                  title: "Nhắc kiểm tra bài tập về nhà",
                  body: `Bạn cần kiểm tra bài tập về nhà cho lớp ${lp.ClassID} (hạn: ${lp.HomeworkCheckDate.replace("T", " ")}).`,
                },
                tokens,
                webpush: {
                  fcmOptions: {
                    link: clientUrl,
                  },
                },
              };

              try {
                const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
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
                console.error("[PUSH ERROR]", err?.message || err?.code || err);
              }
            }
          }
        }
      }
    } catch (err) {
      const errMsg = err?.message || err?.code || err;
      console.error(`[CRON PUSH ERROR] ${errMsg}`);
    }
  });

  console.log("[CRON] Reminder background jobs initialized successfully.");
}
