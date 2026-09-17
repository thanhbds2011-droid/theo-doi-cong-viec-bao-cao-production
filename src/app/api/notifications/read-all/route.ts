import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireActiveUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { profile } = await requireActiveUser(request);
    const db = adminDb();
    const snap = await db.collection("notifications").where("recipientUid", "==", profile.uid).where("read", "==", false).limit(200).get();
    if (snap.empty) return Response.json({ ok: true, updated: 0 });
    const batch = db.batch();
    const now = new Date().toISOString();
    snap.docs.forEach((doc) => batch.update(doc.ref, { read: true, readAt: now }));
    await batch.commit();
    return Response.json({ ok: true, updated: snap.size });
  } catch (error) {
    return jsonError(error);
  }
}
