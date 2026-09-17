"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { WorkForm } from "@/components/WorkForm";

export default function NewWorkPage() {
  return (
    <ProtectedPage>
      <AppShell title="Thêm công việc">
        <WorkForm />
      </AppShell>
    </ProtectedPage>
  );
}
