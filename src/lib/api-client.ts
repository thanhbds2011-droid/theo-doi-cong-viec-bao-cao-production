"use client";

import { auth } from "@/lib/firebase-client";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const FRIENDLY_ERRORS: Record<string, string> = {
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  INVALID_TOKEN: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  ACCOUNT_NOT_ACTIVE: "Tài khoản chưa được phê duyệt hoặc đang tạm khóa.",
  PROFILE_NOT_FOUND: "Chưa thể tải tài khoản của bạn. Vui lòng đăng nhập lại.",
  ADMIN_REQUIRED: "Bạn không có quyền thực hiện thao tác này.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  CONCURRENT_EDIT: "Nội dung này vừa được cập nhật ở nơi khác. Vui lòng tải lại trước khi chỉnh sửa.",
  FILE_TOO_LARGE: "Tệp vượt quá dung lượng cho phép 3 MB.",
  FILE_TYPE_NOT_ALLOWED: "Định dạng tệp này chưa được hỗ trợ.",
  INTERNAL_ERROR: "Hệ thống chưa thể xử lý yêu cầu. Vui lòng thử lại sau.",
  DRIVE_UPLOAD_FAILED: "Chưa thể tải tệp lên. Vui lòng thử lại sau.",
  DRIVE_READ_FAILED: "Chưa thể mở tệp. Vui lòng thử lại sau."
};

function friendlyMessage(status: number, code: string, message: string) {
  if (FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  if (status === 401) return FRIENDLY_ERRORS.UNAUTHENTICATED;
  if (status === 403) return FRIENDLY_ERRORS.FORBIDDEN;
  if (status === 404) return "Không tìm thấy nội dung cần xem.";
  if (status === 409) return FRIENDLY_ERRORS.CONCURRENT_EDIT;
  if (status === 413) return FRIENDLY_ERRORS.FILE_TOO_LARGE;
  if (status >= 500) return FRIENDLY_ERRORS.INTERNAL_ERROR;
  if (/\b(HTTP|API|Firebase|Firestore|undefined|null|token|requestId|fileId)\b/i.test(message))
    return "Không thể hoàn tất thao tác. Vui lòng kiểm tra thông tin và thử lại.";
  return message || "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

async function authHeaders(init?: HeadersInit) {
  const user = auth.currentUser;

  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Bạn chưa đăng nhập.");
  }

  const token = await user.getIdToken();
  const headers = new Headers(init);

  headers.set("Authorization", `Bearer ${token}`);

  return headers;
}

export async function apiFetch<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = await authHeaders(init.headers);

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối đến hệ thống. Vui lòng kiểm tra mạng và thử lại.");
  }

  const contentType = response.headers.get("content-type") || "";

  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const code =
      typeof payload === "object" && payload?.error?.code
        ? payload.error.code
        : "REQUEST_FAILED";

    const message =
      typeof payload === "object" && payload?.error?.message
        ? payload.error.message
        : "Không thể hoàn tất yêu cầu.";

    throw new ApiError(response.status, code, friendlyMessage(response.status, code, message));
  }

  return payload as T;
}

export async function openProtectedFile(
  fileDocId: string,
  download = false
) {
  const previewWindow = !download ? window.open("", "_blank", "noopener,noreferrer") : null;

  try {
    const headers = await authHeaders();
    const response = await fetch(
      `/api/files/${encodeURIComponent(fileDocId)}${download ? "?download=1" : ""}`,
      {
        method: "GET",
        headers,
        cache: "no-store"
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(
        response.status,
        payload?.error?.code || "FILE_OPEN_FAILED",
        friendlyMessage(response.status, payload?.error?.code || "FILE_OPEN_FAILED", payload?.error?.message || "Không thể mở tệp.")
      );
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    if (download) {
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const name = match ? decodeURIComponent(match[1]) : "tai-lieu";
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      return;
    }

    if (previewWindow) {
      previewWindow.location.href = url;
    } else {
      window.location.href = url;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}
