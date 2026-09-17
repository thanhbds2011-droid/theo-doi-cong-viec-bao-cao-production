import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireActiveUser } from "@/lib/server-auth";
import { validateWorkInput } from "@/lib/work-validation";
import { canonicalizeWorkDetails } from "@/lib/work-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { profile } = await requireActiveUser(request);
    const body = await request.json();
    const requestId = String(body?.requestId || "").trim();
    if (!/^[a-zA-Z0-9_-]{12,120}$/.test(requestId)) {
      return Response.json(
        { ok: false, error: { code: "INVALID_REQUEST_ID", message: "Mã yêu cầu không hợp lệ." } },
        { status: 400 }
      );
    }

    const validated = validateWorkInput(body);
    const details = await canonicalizeWorkDetails(validated.workType, validated.details);
    const { workType, workDate } = validated;
    const db = adminDb();
    const recordId = `${profile.uid}_${requestId}`;
    const ref = db.collection("workRecords").doc(recordId);
    const now = new Date().toISOString();
    const [year, month] = workDate.split("-").map(Number);
    const newRecord = {
      ownerUid: profile.uid,
      employeeId: profile.employeeId || `EMP-${profile.uid.slice(0, 8).toUpperCase()}`,
      ownerDisplayName: profile.displayName || profile.email,
      workDate,
      workYear: year,
      workMonth: month,
      workType,
      details,
      attachments: [],
      createdAt: now,
      createdBy: profile.uid,
      updatedAt: now,
      updatedBy: profile.uid
    };

    let created = false;
    let record: Record<string, unknown> = newRecord;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (snap.exists) {
        record = snap.data() || newRecord;
        return;
      }
      transaction.create(ref, newRecord);
      transaction.create(db.collection("audits").doc(), {
        action: "work_create", entityType: "workRecord", entityId: ref.id,
        before: null, after: newRecord, actorUid: profile.uid,
        actorDisplayName: profile.displayName || profile.email, createdAt: now
      });
      created = true;
    });

    if (!created) {
      return Response.json({ ok: true, record: { id: ref.id, ...record }, deduplicated: true });
    }

    return Response.json({ ok: true, record: { id: ref.id, ...newRecord }, deduplicated: false }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
