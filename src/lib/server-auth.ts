import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { AppUser } from "@/lib/types";

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function verifyRequestToken(request: Request): Promise<DecodedIdToken> {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "UNAUTHENTICATED", "Bạn chưa đăng nhập.");
  try {
    return await adminAuth().verifyIdToken(match[1]);
  } catch {
    throw new HttpError(401, "INVALID_TOKEN", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
  }
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await adminDb().collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return { uid: snap.id, ...(snap.data() as Omit<AppUser, "uid">) };
}

export async function requireActiveUser(request: Request) {
  const token = await verifyRequestToken(request);
  const profile = await getUserProfile(token.uid);
  if (!profile) throw new HttpError(403, "PROFILE_NOT_FOUND", "Tài khoản chưa được khởi tạo.");
  if (profile.status !== "active") {
    throw new HttpError(403, "ACCOUNT_NOT_ACTIVE", "Tài khoản chưa được phép sử dụng chức năng này.");
  }
  return { token, profile };
}

export async function requireAdmin(request: Request) {
  const ctx = await requireActiveUser(request);
  if (ctx.profile.role !== "admin") {
    throw new HttpError(403, "ADMIN_REQUIRED", "Bạn không có quyền quản trị.");
  }
  return ctx;
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error(error);
  return Response.json(
    { ok: false, error: { code: "INTERNAL_ERROR", message: "Hệ thống gặp lỗi. Vui lòng thử lại." } },
    { status: 500 }
  );
}
