export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ClientProfileTabs } from "./client-profile-tabs";
import { ClientHeader } from "./client-header";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  await requireRole("super_admin", "marketing");

  const activeTab = tab || "overview";

  const client = await prisma.student.findUnique({
    where: { id },
    include: {
      _count: { select: { bookings: true, enrollments: true, orders: true } },
      creditBalance: true,
      intake: true,
    },
  });

  if (!client) notFound();

  const coreClient = JSON.parse(JSON.stringify(client)) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <ClientHeader
            client={{
              id: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email,
              phone: client.phone,
            }}
            currentStatus={client.clientStatus}
            existingIntake={
              client.intake
                ? {
                    behaviours: client.intake.behaviours,
                    feelings: client.intake.feelings,
                    symptoms: client.intake.symptoms,
                  }
                : null
            }
          />
          <p className="text-sm text-muted-foreground">{client.email}</p>
        </div>
      </div>

      <ClientProfileTabs client={coreClient} activeTab={activeTab} />
    </div>
  );
}
