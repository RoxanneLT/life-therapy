export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { NewDripEmailForm } from "./new-drip-email-form";
import { PageHeader } from "@/components/admin/page-header";

export default async function NewDripEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireAccess("/admin/drip-emails");
  const { type: typeParam } = await searchParams;
  const phase = typeParam === "newsletter" ? "newsletter" : "onboarding";

  // Get existing emails for this phase to populate position selector
  const existingEmails = await prisma.dripEmail.findMany({
    where: { type: phase },
    orderBy: { step: "asc" },
    select: { step: true, dayOffset: true, subject: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/drip-emails", to: "Drip Sequence" }}
        title={`Add ${phase === "newsletter" ? "Newsletter" : "Onboarding"} Email`}
        description={`Insert a new email into the ${phase} sequence. Existing steps will be re-indexed automatically.`}
      />

      <NewDripEmailForm phase={phase} existingEmails={existingEmails} />
    </div>
  );
}
