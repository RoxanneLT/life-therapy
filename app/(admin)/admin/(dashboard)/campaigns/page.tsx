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
import { Plus, Send } from "lucide-react";
import { format } from "date-fns";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sending: "default",
  sent: "secondary",
  failed: "destructive",
};

export default async function CampaignsPage() {
  await requireRole("super_admin", "marketing");

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/admin/campaigns/new">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
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
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Sent / Failed</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Link
                      href={`/admin/campaigns/${campaign.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {campaign.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {campaign.subject}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[campaign.status] || "outline"}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{campaign.totalRecipients}</TableCell>
                  <TableCell className="text-right">
                    {campaign.sentCount > 0 || campaign.failedCount > 0
                      ? `${campaign.sentCount} / ${campaign.failedCount}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.sentAt
                      ? format(new Date(campaign.sentAt), "d MMM yyyy HH:mm")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
