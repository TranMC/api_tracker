import {
  saveFCMToken,
  testMailService,
  sendTestPushNotification,
} from "./notification.service.js";

export async function saveFCMTokenHandler(req, res, next) {
  try {
    const { token, username } = req.body;
    if (!token || !username) {
      return res.status(400).json({ error: "Thiếu token hoặc username" });
    }

    const result = await saveFCMToken(token, username);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function testMailHandler(req, res, next) {
  try {
    const email = await testMailService();
    res.json({ success: true, email });
  } catch (err) {
    next(err);
  }
}

export async function testPushHandler(req, res, next) {
  try {
    const token = req.query?.token || req.body?.token;
    const result = await sendTestPushNotification(token);
    res.json({ success: true, ...result });

  } catch (err) {
    next(err);
  }
}

