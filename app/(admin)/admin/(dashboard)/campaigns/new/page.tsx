export const dynamic = "force-dynamic";

import { requireAccess } from "@/lib/auth";
import { canSeeClinical } from "@/lib/clinical-access";
import { PageHeader } from "@/components/admin/page-header";
import { CampaignEditor } from "./campaign-editor";

export default async function NewCampaignPage() {
  const { adminUser } = await requireAccess("/admin/campaigns");

  return (
    <div>
      <div className="mb-6"><PageHeader title="New Campaign" /></div>
      <CampaignEditor canTargetAssessment={canSeeClinical(adminUser.role)} />
    </div>
  );
}
