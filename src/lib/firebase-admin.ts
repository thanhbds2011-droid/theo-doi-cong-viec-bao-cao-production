import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Chỉ chứa nhãn chẩn đoán cố định. Không đưa nội dung biến môi trường vào lỗi/log.
export class AdminSetupError extends Error {
  constructor(public readonly reason: "MISSING_PROJECT_ID" | "MISSING_CLIENT_EMAIL" | "MISSING_PRIVATE_KEY" | "INVALID_PRIVATE_KEY_FORMAT") {
    super("Firebase Admin configuration is unavailable.");
    this.name = "AdminSetupError";
  }
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId) throw new AdminSetupError("MISSING_PROJECT_ID");
  if (!clientEmail) throw new AdminSetupError("MISSING_CLIENT_EMAIL");
  if (!privateKey) throw new AdminSetupError("MISSING_PRIVATE_KEY");
  if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----") || !privateKey.endsWith("-----END PRIVATE KEY-----")) {
    throw new AdminSetupError("INVALID_PRIVATE_KEY_FORMAT");
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
