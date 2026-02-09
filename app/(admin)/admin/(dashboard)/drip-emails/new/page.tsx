export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NewDripEmailForm } from "./new-drip-email-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NewDripEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireRole("super_admin", "marketing");
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/drip-emails">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Drip Sequence
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="font-heading text-2xl font-bold">
          Add {phase === "newsletter" ? "Newsletter" : "Onboarding"} Email
        </h1>
        <p className="text-sm text-muted-foreground">
          Insert a new email into the {phase} sequence. Existing steps will be
          re-indexed automatically.
        </p>
      </div>

      <NewDripEmailForm phase={phase} existingEmails={existingEmails} />
    </div>
  );
}
