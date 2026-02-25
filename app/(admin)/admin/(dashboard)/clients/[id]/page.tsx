export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getClientInsights } from "@/lib/admin/client-insights";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ClientProfileTabs } from "./client-profile-tabs";
import { ConvertDialog } from "./convert-dialog";
import { StatusSelect } from "./status-select";

const STATUS_COLORS: Record<string, string> = {
  potential: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  archived: "bg-red-100 text-red-700",
};

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

  const client = await prisma.student.findUnique({
    where: { id },
    include: {
      _count: { select: { bookings: true, enrollments: true, orders: true } },
      creditBalance: true,
      intake: true,
      commitmentAcks: { orderBy: { acknowledgedAt: "desc" } },
      documentAcceptances: {
        orderBy: { acceptedAt: "desc" },
        include: { document: { select: { title: true } } },
      },
      bookings: { orderBy: { date: "desc" }, take: 50 },
      enrollments: {
        include: { course: { select: { title: true, slug: true } } },
        orderBy: { enrolledAt: "desc" },
      },
      orders: {
        where: { status: "paid" },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
      digitalProductAccess: {
        include: { digitalProduct: { select: { title: true, slug: true } } },
      },
      creditTransactions: { orderBy: { createdAt: "desc" }, take: 50 },
      dripProgress: true,
      campaignProgress: {
        include: { campaign: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      emailLogs: {
        orderBy: { sentAt: "desc" },
        take: 20,
        select: {
          id: true,
          subject: true,
          status: true,
          sentAt: true,
          openedAt: true,
          opensCount: true,
          clickedAt: true,
          clicksCount: true,
          templateKey: true,
        },
      },
    },
  });

  if (!client) notFound();

  const activeTab = tab || "overview";
  const insights = await getClientInsights(client.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold">
              {client.firstName} {client.lastName}
            </h1>
            <StatusSelect clientId={client.id} currentStatus={client.clientStatus} />
            {client.clientStatus === "potential" && (
              <ConvertDialog
                client={{
                  id: client.id,
                  firstName: client.firstName,
                  lastName: client.lastName,
                  email: client.email,
                  phone: client.phone,
                }}
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
            )}
          </div>
          <p className="text-sm text-muted-foreground">{client.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <ClientProfileTabs
        client={JSON.parse(JSON.stringify(client))}
        activeTab={activeTab}
        insights={JSON.parse(JSON.stringify(insights))}
      />
    </div>
  );
}
