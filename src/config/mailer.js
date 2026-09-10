import nodemailer from "nodemailer";
import fs from "fs";
import { ENV } from "./env.js";

export async function sendMail({ to, subject, text, html, attachments }) {
  if (!ENV.EMAIL_USER || !ENV.EMAIL_PASS) {
    console.warn("[WARN] EMAIL_USER or EMAIL_PASS not configured. Cannot send email.");
    return null;
  }

  if (!to || typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Invalid recipient email address");
  }

  if (subject && subject.length > 200) {
    subject = subject.slice(0, 200);
  }

  const safeAttachments = (attachments || [])
    .slice(0, 5)
    .map(att => {
      if (att && att.path && fs.existsSync(att.path)) {
        const stat = fs.statSync(att.path);
        if (stat.size > 5 * 1024 * 1024) throw new Error("Attachment too large");
        return att;
      }
      return null;
    })
    .filter(Boolean);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: ENV.EMAIL_USER,
      pass: ENV.EMAIL_PASS,
    },
    pool: false,
    secure: true,
  });

  const info = await transporter.sendMail({
    from: ENV.EMAIL_FROM || ENV.EMAIL_USER,
    to,
    subject,
    text,
    html,
    attachments: safeAttachments,
  });

  console.log("[MAIL] SendMail result:", info.messageId || "sent");
  return info;
}
