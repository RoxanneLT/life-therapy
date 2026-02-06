export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const { student } = await requirePasswordChanged();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Account Settings</h1>
      <SettingsClient
        firstName={student.firstName}
        lastName={student.lastName}
        email={student.email}
      />
    </div>
  );
}
