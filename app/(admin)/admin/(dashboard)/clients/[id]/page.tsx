export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saFormat } from "@/lib/dates";
import { recordView } from "@/lib/access-log";
import { notFound } from "next/navigation";
import { ClientProfileTabs } from "./client-profile-tabs";
import { ClientHeader } from "./client-header";
import { PrivacyActions } from "./privacy-actions";
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
  const { adminUser } = await requireAccess("/admin/clients");

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
  // The whole record goes to the browser on every tab, assessment and notes included, so any view
  // of this page is a view of them (lib/access-log.ts).
  await recordView({ actorEmail: adminUser.email, entityType: "student", entityId: id, area: activeTab });

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
            action={
              adminUser.role === "super_admin" && !client.erasedAt ? (
                <PrivacyActions clientId={client.id} clientName={`${client.firstName} ${client.lastName}`} />
              ) : undefined
            }
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
          {client.erasedAt ? (
            <p className="text-sm text-muted-foreground">
              Erased under POPIA on {saFormat(client.erasedAt, "d MMM yyyy")}
              {client.retainUntil ? `; clinical records are removed on ${saFormat(client.retainUntil, "d MMM yyyy")}` : ""}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{client.email}</p>
          )}
          <ContactConflicts entries={contactConflicts} />
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <ClientProfileTabs client={coreClient} activeTab={activeTab} />
      </div>
    </div>
  );
}
