export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { deleteCampaignAction } from "../actions";
import { CampaignActions } from "./campaign-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Edit, Trash2, Users, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sending: "default",
  sent: "secondary",
  failed: "destructive",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin", "marketing");
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();

  // Get delivery logs for sent campaigns
  const emailLogs = campaign.status === "sent" || campaign.status === "failed"
    ? await prisma.emailLog.findMany({
        where: {
          templateKey: "campaign_broadcast",
          metadata: { path: ["campaignId"], equals: id },
        },
        orderBy: { sentAt: "desc" },
        take: 100,
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/campaigns"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={STATUS_VARIANTS[campaign.status] || "outline"}>
              {campaign.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{campaign.subject}</p>
        </div>
        {campaign.status === "draft" && (
          <div className="flex gap-2">
            <Link href={`/admin/campaigns/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{campaign.totalRecipients}</p>
                <p className="text-sm text-muted-foreground">Recipients</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{campaign.sentCount}</p>
                <p className="text-sm text-muted-foreground">Sent</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{campaign.failedCount}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions (send test / send campaign) for draft */}
        {campaign.status === "draft" && (
          <CampaignActions campaignId={campaign.id} />
        )}

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              srcDoc={wrapPreview(campaign.bodyHtml)}
              className="h-[500px] w-full rounded border"
              sandbox=""
              title="Campaign Preview"
            />
          </CardContent>
        </Card>

        {/* Filters used */}
        {(campaign.filterSource || campaign.filterTags) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audience Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {campaign.filterSource && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <Badge variant="outline">{campaign.filterSource}</Badge>
                </div>
              )}
              {campaign.filterTags && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tags</span>
                  <span>{(campaign.filterTags as string[]).join(", ")}</span>
                </div>
              )}
              {campaign.sentAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent at</span>
                  <span>{format(new Date(campaign.sentAt), "d MMM yyyy HH:mm")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delivery Log */}
        {emailLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery Log</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">{log.to}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === "sent" ? "secondary" : "destructive"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {log.error || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(log.sentAt), "HH:mm:ss")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Delete (only drafts) */}
        {campaign.status === "draft" && (
          <Card className="border-destructive/30">
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="font-medium text-destructive">Delete Campaign</p>
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              </div>
              <form action={deleteCampaignAction}>
                <input type="hidden" name="id" value={campaign.id} />
                <Button variant="destructive" size="sm" type="submit">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function wrapPreview(body: string): string {
  const previewBody = body
    .replace(/\{\{firstName\}\}/g, "Jane")
    .replace(/\{\{unsubscribeUrl\}\}/g, "#");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="padding: 32px 24px;">${previewBody}</div>
  </div>
</body></html>`;
}
