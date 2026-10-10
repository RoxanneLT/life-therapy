export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { canSeeClinical } from "@/lib/clinical-access";
import { PageHeader } from "@/components/admin/page-header";
import { CampaignEditor } from "../../new/campaign-editor";
import { BirthdayCampaignEditor } from "../../new/birthday-campaign-editor";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { adminUser } = await requireAccess("/admin/campaigns");
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { emails: { orderBy: { step: "asc" } } },
  });
  if (!campaign) notFound();

  // Birthday campaigns can be edited even when active
  if (campaign.campaignType === "birthday") {
    return (
      <div>
        <div className="mb-6"><PageHeader title="Edit Birthday Campaign" /></div>
        <BirthdayCampaignEditor campaign={campaign} />
      </div>
    );
  }

  // Standard campaigns can only be edited in draft
  if (campaign.status !== "draft") {
    redirect(`/admin/campaigns/${id}`);
  }

  return (
    <div>
      <div className="mb-6"><PageHeader title="Edit Campaign" /></div>
      <CampaignEditor campaign={campaign} canTargetAssessment={canSeeClinical(adminUser.role)} />
    </div>
  );
}
