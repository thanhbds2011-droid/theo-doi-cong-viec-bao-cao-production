"use client";

import { BriefcaseBusiness, GraduationCap, Landmark, ReceiptText, ShieldCheck } from "lucide-react";
import type { WorkType } from "@/lib/types";

export function WorkTypeIcon({ type, size = 18 }: { type: WorkType; size?: number }) {
  if (type === "salary") return <BriefcaseBusiness size={size} />;
  if (type === "bhxh") return <ShieldCheck size={size} />;
  if (type === "tax") return <ReceiptText size={size} />;
  if (type === "vocational") return <GraduationCap size={size} />;
  return <Landmark size={size} />;
}
