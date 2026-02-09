export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { CampaignEditor } from "./campaign-editor";

export default async function NewCampaignPage() {
  await requireRole("super_admin", "marketing");

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">New Campaign</h1>
      <CampaignEditor />
    </div>
  );
}
