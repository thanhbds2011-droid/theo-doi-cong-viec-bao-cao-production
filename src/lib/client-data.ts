"use client";

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import type { AppNotification, AppUser, AuditEntry, CategoryItem, WorkRecord, WorkType } from "@/lib/types";

function withId<T>(doc: QueryDocumentSnapshot<DocumentData>) {
  return { id: doc.id, ...doc.data() } as T;
}

export async function fetchCategories(includeInactive = false) {
  const constraints: QueryConstraint[] = [];
  if (!includeInactive) constraints.push(where("isActive", "==", true));
  const snap = await getDocs(query(collection(db, "categories"), ...constraints));
  return snap.docs
    .map((doc) => withId<CategoryItem>(doc))
    .sort((a, b) => a.workType.localeCompare(b.workType) || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export type WorkQueryInput = {
  role: "employee" | "admin";
  uid: string;
  ownerUid?: string;
  from?: string;
  to?: string;
  workType?: WorkType | "";
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  direction?: "asc" | "desc";
};

export async function fetchWorkRecords(input: WorkQueryInput) {
  const constraints: QueryConstraint[] = [];
  if (input.role === "employee") constraints.push(where("ownerUid", "==", input.uid));
  else if (input.ownerUid) constraints.push(where("ownerUid", "==", input.ownerUid));
  if (input.workType) constraints.push(where("workType", "==", input.workType));
  if (input.from) constraints.push(where("workDate", ">=", input.from));
  if (input.to) constraints.push(where("workDate", "<=", input.to));
  constraints.push(orderBy("workDate", input.direction || "desc"));
  constraints.push(limit(input.pageSize || 20));
  if (input.cursor) constraints.push(startAfter(input.cursor));

  const snap = await getDocs(query(collection(db, "workRecords"), ...constraints));
  return {
    records: snap.docs.map((doc) => withId<WorkRecord>(doc)),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null
  };
}


export async function fetchAllWorkRecords(input: Omit<WorkQueryInput, "cursor" | "pageSize">, batchSize = 500) {
  const records: WorkRecord[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

  while (true) {
    const result = await fetchWorkRecords({ ...input, pageSize: batchSize, cursor });
    records.push(...result.records);
    cursor = result.cursor;
    if (!cursor || result.records.length < batchSize) break;
  }

  return records;
}

export function subscribeNotifications(uid: string, callback: (items: AppNotification[]) => void) {
  return onSnapshot(
    query(collection(db, "notifications"), where("recipientUid", "==", uid), orderBy("createdAt", "desc"), limit(40)),
    (snap) => callback(snap.docs.map((doc) => withId<AppNotification>(doc))),
    (error) => console.error("Notification listener error", error)
  );
}

export async function fetchAudits(pageSize = 100) {
  const snap = await getDocs(query(collection(db, "audits"), orderBy("createdAt", "desc"), limit(pageSize)));
  return snap.docs.map((doc) => withId<AuditEntry>(doc));
}

export async function fetchActiveEmployees() {
  const snap = await getDocs(query(collection(db, "users"), where("status", "==", "active")));
  return snap.docs
    .map((doc) => ({ uid: doc.id, ...doc.data() } as AppUser))
    .filter((u) => u.role === "employee")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
