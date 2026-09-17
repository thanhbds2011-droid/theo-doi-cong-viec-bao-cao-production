import { adminDb } from "@/lib/firebase-admin";
import { HttpError, jsonError, requireActiveUser } from "@/lib/server-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const { profile } = await requireActiveUser(request);
    const { id } = await context.params;
    const ref = adminDb().collection("notifications").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy thông báo.");
    const data = snap.data() as any;
    if (data.recipientUid !== profile.uid) {
      throw new HttpError(403, "FORBIDDEN", "Bạn không được thao tác thông báo này.");
    }
    await ref.update({ read: true, readAt: new Date().toISOString() });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
