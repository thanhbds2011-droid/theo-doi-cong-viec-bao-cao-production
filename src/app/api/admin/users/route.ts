import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireAdmin } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const snap = await adminDb().collection("users").limit(500).get();
    const users = snap.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => String(b.requestedAt || "").localeCompare(String(a.requestedAt || "")));
    return Response.json({ ok: true, users });
  } catch (error) {
    return jsonError(error);
  }
}
