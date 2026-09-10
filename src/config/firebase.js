import admin from "firebase-admin";
import { ENV } from "./env.js";

let firebaseAdmin = null;

if (ENV.GOOGLE_SERVICE_ACCOUNT_JSON_FIREBASE) {
  try {
    const serviceAccountFirebase = JSON.parse(ENV.GOOGLE_SERVICE_ACCOUNT_JSON_FIREBASE);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFirebase),
      });
    }
    firebaseAdmin = admin;
  } catch (err) {
    console.error("[ERROR] Failed to initialize Firebase Admin:", err.message);
  }
}

export { firebaseAdmin };
