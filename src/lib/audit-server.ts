import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import type { AppUser, AuditEntry } from "@/lib/types";

export async function writeAudit(input: Omit<AuditEntry, "id" | "createdAt" | "actorUid" | "actorDisplayName">, actor: AppUser) {
  const now = new Date().toISOString();
  await adminDb().collection("audits").add({
    ...input,
    actorUid: actor.uid,
    actorDisplayName: actor.displayName || actor.email,
    createdAt: now
  });
}
