export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Send, ListOrdered, Mail, Cake, Edit } from "lucide-react";
import { format } from "date-fns";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sending: "default",
  sent: "secondary",
  failed: "destructive",
  scheduled: "default",
  active: "default",
  completed: "secondary",
  paused: "outline",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  active: "bg-green-100 text-green-800 hover:bg-green-100",
  completed: "bg-teal-100 text-teal-800 hover:bg-teal-100",
  paused: "bg-amber-100 text-amber-800 hover:bg-amber-100",
};

export default async function CampaignsPage() {
  await requireRole("super_admin", "marketing");

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { emails: true } } },
    take: 100,
  });

  const manualCampaigns = campaigns.filter((c) => c.campaignType !== "birthday");
  const automatedCampaigns = campaigns.filter((c) => c.campaignType === "birthday");

  return (
    <div className="space-y-10">
      {/* ── Manual Campaigns ── */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Campaigns</h1>
            <p className="text-sm text-muted-foreground">
              {manualCampaigns.length} campaign{manualCampaigns.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link href="/admin/campaigns/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </Link>
        </div>

        {manualCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-muted-foreground">
            <Send className="mb-4 h-12 w-12 opacity-40" />
            <p className="text-lg font-medium">No campaigns yet</p>
            <p className="text-sm">Create your first campaign to start reaching your contacts.</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Sent / Failed</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualCampaigns.map((campaign) => {
                  const statusColor = STATUS_COLORS[campaign.status];
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        {!campaign.isMultiStep && campaign.subject && (
                          <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {campaign.subject}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {campaign.isMultiStep ? (
                          <Badge variant="outline" className="text-xs">
                            <ListOrdered className="mr-1 h-3 w-3" />
                            {campaign._count.emails} steps
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Mail className="mr-1 h-3 w-3" />
                            Broadcast
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_VARIANTS[campaign.status] || "outline"}
                          className={statusColor || ""}
                        >
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {campaign.startDate
                          ? format(new Date(campaign.startDate), "d MMM yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">{campaign.totalRecipients}</TableCell>
                      <TableCell className="text-right">
                        {campaign.sentCount > 0 || campaign.failedCount > 0
                          ? `${campaign.sentCount} / ${campaign.failedCount}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(campaign.createdAt), "d MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Automated Campaigns ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold">Automated Campaigns</h2>
            <p className="text-sm text-muted-foreground">
              Always-on campaigns triggered by events like birthdays.
            </p>
          </div>
        </div>

        {automatedCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-muted-foreground">
            <Cake className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">No automated campaigns yet</p>
            <p className="mb-4 text-xs">Birthday campaigns send automatically when a client&apos;s DOB matches today.</p>
            <p className="text-xs text-muted-foreground">Run the birthday seed SQL to create one, or build one from the campaign editor.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {automatedCampaigns.map((campaign) => {
              const statusColor = STATUS_COLORS[campaign.status];
              return (
                <div
                  key={campaign.id}
                  className="rounded-lg border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-50">
                        <Cake className="h-4.5 w-4.5 text-pink-600" />
                      </div>
                      <div>
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="font-semibold text-foreground hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {campaign._count.emails} templates
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={STATUS_VARIANTS[campaign.status] || "outline"}
                      className={statusColor || ""}
                    >
                      {campaign.status}
                    </Badge>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Sent this year</p>
                      <p className="font-semibold">{campaign.sentCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Failed</p>
                      <p className="font-semibold">{campaign.failedCount}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/admin/campaigns/${campaign.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </Link>
                    <Link href={`/admin/campaigns/${campaign.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
