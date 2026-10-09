export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { CampaignEditor } from "./campaign-editor";

export default async function NewCampaignPage() {
  await requireRole("super_admin", "marketing");

  return (
    <div>
      <div className="mb-6"><PageHeader title="New Campaign" /></div>
      <CampaignEditor />
    </div>
  );
}
