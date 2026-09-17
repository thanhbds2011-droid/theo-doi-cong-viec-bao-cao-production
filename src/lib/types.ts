export type UserStatus = "pending" | "active" | "rejected" | "disabled";
export type UserRole = "employee" | "admin";
export type WorkType = "salary" | "bhxh" | "tax" | "other" | "vocational";

export interface AppUser {
  uid: string;
  email: string;
  googleDisplayName: string;
  displayName: string;
  employeeId: string | null;
  role: UserRole;
  status: UserStatus;
  photoURL?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectedReason?: string | null;
  onboardingNotifiedAt?: string | null;
  disabledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface CategoryItem {
  id: string;
  workType: Exclude<WorkType, "salary">;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkDetails =
  | {
      quantity: number;
      organization: string;
    }
  | {
      organization: string;
      contentCategoryId?: string;
      contentLabel: string;
      tphs?: string;
      resultDate?: string;
    }
  | {
      organization: string;
      contentCategoryId?: string;
      contentLabel: string;
    }
  | {
      contentCategoryId?: string;
      contentLabel: string;
      time: string;
      trainingInstitution: string;
    };

export interface AttachmentSummary {
  fileDocId: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  uploadedAt: string;
}

export interface WorkRecord {
  id: string;
  ownerUid: string;
  employeeId: string;
  ownerDisplayName: string;
  workDate: string;
  workYear: number;
  workMonth: number;
  workType: WorkType;
  details: WorkDetails;
  attachments: AttachmentSummary[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AppNotification {
  id: string;
  recipientUid: string;
  type: "account" | "work" | "system" | "admin";
  title: string;
  message: string;
  relatedRecordId?: string | null;
  relatedUserUid?: string | null;
  createdAt: string;
  read: boolean;
  readAt?: string | null;
}

export interface AuditEntry {
  id: string;
  action:
    | "work_create"
    | "work_update"
    | "work_delete"
    | "account_update"
    | "category_create"
    | "category_update"
    | "system_reset";
  entityType: "workRecord" | "user" | "category" | "system";
  entityId: string;
  actorUid: string;
  actorDisplayName: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}
