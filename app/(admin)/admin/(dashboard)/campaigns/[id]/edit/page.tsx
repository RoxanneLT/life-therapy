export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { CampaignEditor } from "../../new/campaign-editor";
import { BirthdayCampaignEditor } from "../../new/birthday-campaign-editor";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin", "marketing");
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
        <h1 className="mb-6 font-heading text-2xl font-bold">Edit Birthday Campaign</h1>
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
      <h1 className="mb-6 font-heading text-2xl font-bold">Edit Campaign</h1>
      <CampaignEditor campaign={campaign} />
    </div>
  );
}
