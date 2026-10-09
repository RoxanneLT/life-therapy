export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saFormat } from "@/lib/dates";
import { recordView } from "@/lib/access-log";
import { canSeeClinical } from "@/lib/clinical-access";
import { externalHolders } from "@/lib/popia/external-holders";
import { notFound } from "next/navigation";
import { ClientProfileTabs } from "./client-profile-tabs";
import { ClientHeader } from "./client-header";
import { ErasureCleanupNotice, PrivacyActions } from "./privacy-actions";
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
  const clinical = canSeeClinical(adminUser.role);

  const client = await prisma.student.findUnique({
    where: { id },
    include: {
      _count: { select: { bookings: true, enrollments: true, orders: true } },
      creditBalance: true,
      // The assessment is clinical: a role that may not read it is never sent it (lib/clinical-access.ts).
      intake: clinical,
    },
  });

  if (!client) notFound();
  // The whole record goes to the browser on every tab, assessment and notes included for a role that
  // may read them, so any view of this page is a view of them (lib/access-log.ts).
  await recordView({ actorEmail: adminUser.email, entityType: "student", entityId: id, area: activeTab });

  // An erased client whose outside clean-up nobody has marked done (lib/popia/external-holders.ts).
  const cleanup =
    client.erasedAt && adminUser.role === "super_admin" &&
    !(await prisma.auditLog.findFirst({ where: { entityType: "student", entityId: id, action: "client_erasure_external_done" }, select: { id: true } }))
      ? await externalHolders(id)
      : null;

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
              adminUser.role === "super_admin" ? (
                <PrivacyActions clientId={client.id} clientName={`${client.firstName} ${client.lastName}`} erased={!!client.erasedAt} />
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
            <>
              <p className="text-sm text-muted-foreground">
                Erased under POPIA on {saFormat(client.erasedAt, "d MMM yyyy")}
                {client.retainUntil ? `; clinical records are removed on ${saFormat(client.retainUntil, "d MMM yyyy")}` : ""}.
              </p>
              {cleanup && <ErasureCleanupNotice clientId={client.id} holders={cleanup} />}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{client.email}</p>
          )}
          <ContactConflicts entries={contactConflicts} />
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <ClientProfileTabs client={coreClient} activeTab={activeTab} canSeeActivity={adminUser.role === "super_admin"} canSeeClinical={clinical} />
      </div>
    </div>
  );
}
