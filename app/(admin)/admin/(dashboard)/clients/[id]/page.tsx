export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ClientProfileTabs } from "./client-profile-tabs";
import { ClientHeader } from "./client-header";
import { ContactConflicts } from "./contact-conflicts";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  await requireAccess("/admin/clients");

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

  const contactConflicts = await prisma.auditLog.findMany({
    where: { entityType: "student", entityId: id, action: "contact_field_conflict" },
    select: { id: true, createdAt: true, metadata: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const coreClient = JSON.parse(JSON.stringify(client)) as Record<string, unknown>;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <div>
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
          <ContactConflicts entries={contactConflicts} />
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <ClientProfileTabs client={coreClient} activeTab={activeTab} />
      </div>
    </div>
  );
}
