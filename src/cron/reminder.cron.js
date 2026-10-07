import cron from "node-cron";
import { getSheetData, getSheetHeaders, updateSheetRow } from "../common/sheets.dao.js";
import { sendMail } from "../config/mailer.js";
import { firebaseAdmin } from "../config/firebase.js";
import { ENV } from "../config/env.js";

export function initReminderCronJobs() {
  // Gộp tác vụ kiểm tra nhắc việc định kỳ (Email & Web Push) thành 1 cron duy nhất mỗi phút
  // Giúp giảm tải 75% request Google Sheets và tránh xung đột cập nhật / DNS timeout
  cron.schedule("* * * * *", async () => {
    try {
      // 1. Chỉ gọi Google Sheets lấy LessonProgress 1 lần
      const lessonProgress = await getSheetData("LessonProgress");
      if (!Array.isArray(lessonProgress) || lessonProgress.length === 0) return;

      const now = new Date();

      // 2. Lọc các mục thỏa mãn điều kiện thời gian và chưa xử lý xong thông báo
      const candidates = [];
      for (let i = 0; i < lessonProgress.length; i++) {
        const lp = lessonProgress[i];
        if (
          lp.HomeworkCheckDate &&
          lp.Checked !== "yes" &&
          (lp.NotificationSent !== "yes" || (firebaseAdmin && lp.Pushed !== "yes"))
        ) {
          const checkDateStr = lp.HomeworkCheckDate.replace(" ", "T");
          const checkDate = new Date(checkDateStr);
          const diff = (checkDate.getTime() - now.getTime()) / 60000;

          // Còn <= 10 phút hoặc mới quá hạn <= 60 phút
          if (diff <= 10 && diff >= -60) {
            candidates.push({ index: i, lp });
          }
        }
      }

      // Nếu không có lớp nào cần nhắc nhở trong phút này, thoát ngay (không tốn thêm request nào!)
      if (candidates.length === 0) return;

      // 3. Tải danh sách người nhận chỉ khi thực sự có dòng cần gửi
      let accounts = [];
      let fcmTokens = [];

      const needEmail = candidates.some(({ lp }) => lp.NotificationSent !== "yes");
      const needPush = firebaseAdmin && candidates.some(({ lp }) => lp.Pushed !== "yes");

      if (needEmail) {
        accounts = await getSheetData("accounts").catch((e) => {
          console.warn("[CRON] Không thể lấy danh sách accounts:", e.message);
          return [];
        });
      }

      if (needPush) {
        fcmTokens = await getSheetData("FCMTokens").catch((e) => {
          console.warn("[CRON] Không thể lấy danh sách FCMTokens:", e.message);
          return [];
        });
      }

      let cachedHeaders = null;

      // 4. Xử lý từng mục
      for (const { index: i, lp } of candidates) {
        let updatedLp = { ...lp };
        let hasChanges = false;

        // Xử lý Email
        if (updatedLp.NotificationSent !== "yes") {
          let targetEmail = "";
          let teacherName = "";

          const teacherWithEmail = accounts.find((acc) => acc.email);
          if (teacherWithEmail && teacherWithEmail.email) {
            targetEmail = teacherWithEmail.email;
            teacherName = teacherWithEmail.FullName || teacherWithEmail.username || "";
          } else if (ENV.EMAIL_USER) {
            targetEmail = ENV.EMAIL_USER;
            teacherName = "Thầy/Cô";
          }

          if (targetEmail) {
            try {
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
              updatedLp.NotificationSent = "yes";
              hasChanges = true;
              console.log(`[EMAIL] Đã gửi nhắc nhở kiểm tra BTVN cho lớp ${lp.ClassID} ngày ${lp.Date} tới ${targetEmail}`);
            } catch (mailErr) {
              console.error(`[EMAIL ERROR] Gửi email thất bại cho lớp ${lp.ClassID}:`, mailErr.message);
            }
          }
        }

        // Xử lý Web Push Notification
        if (firebaseAdmin && updatedLp.Pushed !== "yes") {
          const tokens = fcmTokens.map((row) => row.token).filter(Boolean);
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
              updatedLp.Pushed = "yes";
              hasChanges = true;
            } catch (err) {
              console.error("[PUSH ERROR]", err?.message || err?.code || err);
            }
          }
        }

        // Nếu có cập nhật trạng thái thông báo, ghi lại vào Google Sheet
        if (hasChanges) {
          if (!cachedHeaders) {
            cachedHeaders = await getSheetHeaders("LessonProgress");
          }
          const rowValues = cachedHeaders.map((h) => (updatedLp[h] !== undefined ? updatedLp[h] : ""));
          await updateSheetRow("LessonProgress", i, rowValues);
        }
      }
    } catch (err) {
      const errMsg = err?.message || err?.code || err;
      console.error(`[CRON REMINDER ERROR] ${errMsg}`);
    }
  });

  console.log("[CRON] Reminder background jobs initialized successfully.");
}
