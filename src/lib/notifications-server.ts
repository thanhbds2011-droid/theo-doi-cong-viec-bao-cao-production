import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import type { AppNotification } from "@/lib/types";

export async function createNotification(input: Omit<AppNotification, "id" | "createdAt" | "read">) {
  await adminDb().collection("notifications").add({
    ...input,
    createdAt: new Date().toISOString(),
    read: false,
    readAt: null
  });
}

export async function notifyActiveAdmins(title: string, message: string, relatedRecordId?: string | null) {
  const db = adminDb();
  const admins = await db.collection("users").where("role", "==", "admin").where("status", "==", "active").get();
  const batch = db.batch();
  const now = new Date().toISOString();
  admins.docs.forEach((doc) => {
    const ref = db.collection("notifications").doc();
    batch.set(ref, {
      recipientUid: doc.id,
      type: "admin",
      title,
      message,
      relatedRecordId: relatedRecordId || null,
      createdAt: now,
      read: false,
      readAt: null
    });
  });
  if (!admins.empty) await batch.commit();
}

/** Lưu một thông báo duy nhất trên mỗi cặp người yêu cầu/quản trị viên.
 *  Khi bootstrap chạy lại, không đưa thông báo đã đọc trở về trạng thái chưa đọc.
 */
export async function notifyNewAccount(uid: string, name: string) {
  const db = adminDb();
  const admins = await db.collection("users").where("role", "==", "admin").where("status", "==", "active").get();
  for (const user of admins.docs) {
    const ref = db.collection("notifications").doc(`account-request_${uid}_${user.id}`);
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (snap.exists) return;
      transaction.create(ref, {
        recipientUid: user.id,
        type: "admin",
        title: "Có yêu cầu truy cập mới",
        message: `${name} vừa gửi yêu cầu sử dụng hệ thống.`,
        relatedRecordId: null,
        relatedUserUid: uid,
        createdAt: new Date().toISOString(),
        read: false,
        readAt: null
      });
    });
  }
}
