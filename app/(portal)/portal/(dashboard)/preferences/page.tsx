export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { PreferencesClient } from "./preferences-client";

export default async function PreferencesPage() {
  const { student } = await requirePasswordChanged();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Preferences</h1>
      <PreferencesClient
        newsletterOptIn={student.newsletterOptIn}
        marketingOptIn={student.marketingOptIn}
        smsOptIn={student.smsOptIn}
        sessionReminders={student.sessionReminders}
      />
    </div>
  );
}
