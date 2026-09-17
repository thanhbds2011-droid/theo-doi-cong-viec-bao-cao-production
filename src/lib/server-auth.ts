import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { AdminSetupError, adminAuth, adminDb } from "@/lib/firebase-admin";
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

// Chỉ ghi mã lỗi nằm trong danh sách cố định, tuyệt đối không ghi lỗi thô vì
// error.message/stack của SDK có thể chứa thông tin cấu hình nhạy cảm.
const SAFE_AUTH_ERROR_CODES = new Set([
  "auth/argument-error", "auth/invalid-id-token", "auth/id-token-expired",
  "auth/id-token-revoked", "auth/user-disabled", "auth/invalid-credential",
  "auth/insufficient-permission", "auth/project-not-found",
  "auth/network-request-failed", "auth/internal-error", "app/invalid-credential",
  "app/invalid-app-options"
]);
const TOKEN_ERROR_CODES = new Set([
  "auth/argument-error", "auth/invalid-id-token", "auth/id-token-expired",
  "auth/id-token-revoked", "auth/user-disabled"
]);

function safeAuthCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && SAFE_AUTH_ERROR_CODES.has(code) ? code : "unknown";
}

// Chỉ so sánh aud/iss để chẩn đoán. JWT chưa được xác minh KHÔNG được dùng
// để cấp quyền; không ghi JWT, UID, email hay bất kỳ claim nào ra nhật ký.
function tokenProjectCheck(token: string): { audience: string; issuer: string } {
  const unknown = { audience: "unavailable", issuer: "unavailable" };
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const segments = token.split(".");
  if (!projectId || segments.length !== 3 || segments[1].length > 12_000) return unknown;
  try {
    const payload: unknown = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return unknown;
    const claims = payload as Record<string, unknown>;
    return {
      audience: typeof claims.aud === "string" ? (claims.aud === projectId ? "match" : "mismatch") : "unavailable",
      issuer: typeof claims.iss === "string" ? (claims.iss === `https://securetoken.google.com/${projectId}` ? "match" : "mismatch") : "unavailable"
    };
  } catch {
    return unknown;
  }
}

export async function verifyRequestToken(request: Request): Promise<DecodedIdToken> {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "UNAUTHENTICATED", "Bạn chưa đăng nhập.");

  // Tách khởi tạo SDK khỏi xác minh token, để lỗi cấu hình server không bị
  // báo sai là phiên đăng nhập người dùng hết hạn.
  let verifier: ReturnType<typeof adminAuth>;
  try {
    verifier = adminAuth();
  } catch (error) {
    const reason = error instanceof AdminSetupError ? error.reason : safeAuthCode(error);
    console.error("[AUTH_DIAG] stage=admin_init", { reason });
    throw new HttpError(500, "AUTH_SERVER_UNAVAILABLE", "Hệ thống chưa thể xác thực tài khoản. Vui lòng thử lại sau.");
  }

  try {
    return await verifier.verifyIdToken(match[1]);
  } catch (error) {
    const code = safeAuthCode(error);
    // Chỉ ghi mã lỗi an toàn và kết quả so khớp, không ghi token/claims/secret.
    console.error("[AUTH_DIAG] stage=verify_id_token", { code, ...tokenProjectCheck(match[1]) });
    if (TOKEN_ERROR_CODES.has(code)) {
      throw new HttpError(401, "INVALID_TOKEN", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    }
    throw new HttpError(500, "AUTH_SERVER_UNAVAILABLE", "Hệ thống chưa thể xác thực tài khoản. Vui lòng thử lại sau.");
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
