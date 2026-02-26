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
import {
  ArrowLeft,
  Edit,
  Trash2,
  Users,
  CheckCircle,
  XCircle,
  Mail,
  ListOrdered,
  Calendar,
  Eye,
  MousePointer,
  Cake,
} from "lucide-react";
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

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin", "marketing");
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      emails: { orderBy: { step: "asc" } },
      _count: { select: { progress: true } },
    },
  });
  if (!campaign) notFound();

  // Get completed progress count for multi-step
  const completedContacts = campaign.isMultiStep
    ? await prisma.campaignProgress.count({
        where: { campaignId: id, completedAt: { not: null } },
      })
    : 0;

  // Get email logs for tracking stats
  const emailLogs = ["sent", "failed", "completed", "active", "paused"].includes(campaign.status)
    ? await prisma.emailLog.findMany({
        where: campaign.campaignType === "birthday"
          ? { metadata: { path: ["campaignId"], equals: id } }
          : campaign.isMultiStep
            ? { templateKey: { startsWith: `campaign_${id}_` } }
            : {
                templateKey: "campaign_broadcast",
                metadata: { path: ["campaignId"], equals: id },
              },
        orderBy: { sentAt: "desc" },
        take: 200,
      })
    : [];

  // Aggregate tracking stats
  const totalSentLogs = emailLogs.filter((l) => l.status === "sent").length;
  const totalOpened = emailLogs.filter((l) => l.openedAt).length;
  const totalClicked = emailLogs.filter((l) => l.clickedAt).length;
  const openRate = totalSentLogs > 0 ? Math.round((totalOpened / totalSentLogs) * 100) : 0;
  const clickRate = totalSentLogs > 0 ? Math.round((totalClicked / totalSentLogs) * 100) : 0;

  // Per-step stats for multi-step campaigns
  const stepStats = (campaign.isMultiStep || campaign.campaignType === "birthday")
    ? campaign.emails.map((email) => {
        // Birthday uses campaignEmailId in metadata; standard uses templateKey
        const stepLogs = campaign.campaignType === "birthday"
          ? emailLogs.filter((l) => {
              const meta = l.metadata as Record<string, unknown> | null;
              return meta?.campaignEmailId === email.id;
            })
          : emailLogs.filter((l) => l.templateKey === `campaign_${id}_${email.step}`);
        const stepSent = stepLogs.filter((l) => l.status === "sent").length;
        const stepOpened = stepLogs.filter((l) => l.openedAt).length;
        const stepClicked = stepLogs.filter((l) => l.clickedAt).length;
        return {
          step: email.step,
          dayOffset: email.dayOffset,
          subject: email.subject,
          sent: stepSent,
          failed: stepLogs.filter((l) => l.status === "failed").length,
          opened: stepOpened,
          clicked: stepClicked,
          openRate: stepSent > 0 ? Math.round((stepOpened / stepSent) * 100) : 0,
          clickRate: stepSent > 0 ? Math.round((stepClicked / stepSent) * 100) : 0,
        };
      })
    : [];

  const showActions = ["draft", "scheduled", "active", "paused"].includes(campaign.status);
  const canEdit = campaign.status === "draft" || campaign.campaignType === "birthday";
  const canDelete = campaign.status === "draft";
  const statusColor = STATUS_COLORS[campaign.status];

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
            <Badge
              variant={STATUS_VARIANTS[campaign.status] || "outline"}
              className={statusColor || ""}
            >
              {campaign.status}
            </Badge>
            <Badge variant="outline" className={campaign.campaignType === "birthday" ? "bg-pink-50 text-pink-700 border-pink-200" : ""}>
              {campaign.campaignType === "birthday" ? (
                <>
                  <Cake className="mr-1 h-3 w-3" />
                  Birthday ({campaign.emails.length} templates)
                </>
              ) : campaign.isMultiStep ? (
                <>
                  <ListOrdered className="mr-1 h-3 w-3" />
                  {campaign.emails.length} steps
                </>
              ) : (
                <>
                  <Mail className="mr-1 h-3 w-3" />
                  Broadcast
                </>
              )}
            </Badge>
          </div>
          {!campaign.isMultiStep && campaign.subject && (
            <p className="mt-1 text-sm text-muted-foreground">{campaign.subject}</p>
          )}
        </div>
        {canEdit && (
          <Link href={`/admin/campaigns/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6">
        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-5">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{campaign.totalRecipients}</p>
                <p className="text-xs text-muted-foreground">Recipients</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{campaign.sentCount}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{campaign.failedCount}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Eye className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{openRate}%</p>
                <p className="text-xs text-muted-foreground">Open Rate</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <MousePointer className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{clickRate}%</p>
                <p className="text-xs text-muted-foreground">Click Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Multi-step: completed contacts (not for birthday) */}
        {campaign.isMultiStep && campaign.campaignType !== "birthday" && campaign.status !== "draft" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <span>
                  <strong>{completedContacts}</strong> / {campaign._count.progress} contacts completed all steps
                </span>
                {campaign._count.progress > 0 && (
                  <span className="text-muted-foreground">
                    ({Math.round((completedContacts / campaign._count.progress) * 100)}%)
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule info for multi-step */}
        {campaign.isMultiStep && (campaign.startDate || campaign.activatedAt || campaign.completedAt) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Calendar className="mr-2 inline h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                {campaign.startDate && (
                  <div>
                    <span className="text-muted-foreground">Start Date: </span>
                    <span className="font-medium">
                      {format(new Date(campaign.startDate), "d MMM yyyy")}
                    </span>
                  </div>
                )}
                {campaign.activatedAt && (
                  <div>
                    <span className="text-muted-foreground">Activated: </span>
                    <span className="font-medium">
                      {format(new Date(campaign.activatedAt), "d MMM yyyy HH:mm")}
                    </span>
                  </div>
                )}
                {campaign.completedAt && (
                  <div>
                    <span className="text-muted-foreground">Completed: </span>
                    <span className="font-medium">
                      {format(new Date(campaign.completedAt), "d MMM yyyy HH:mm")}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {showActions && (
          <CampaignActions
            campaignId={campaign.id}
            status={campaign.status}
            isMultiStep={campaign.isMultiStep}
            startDate={campaign.startDate?.toISOString() || null}
            stepCount={campaign.emails.length}
          />
        )}

        {/* Multi-step / Birthday: Email table */}
        {(campaign.isMultiStep || campaign.campaignType === "birthday") && campaign.emails.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {campaign.campaignType === "birthday" ? "Birthday Templates" : "Email Steps"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaign.campaignType === "birthday" ? (
                /* Birthday: group by gender */
                <div className="space-y-6">
                  {(["female", "male", "unknown"] as const).map((gender) => {
                    const genderEmails = campaign.emails.filter((e) => (e.genderTarget || "unknown") === gender);
                    if (genderEmails.length === 0) return null;
                    const genderLabel = gender === "female" ? "👩 Women" : gender === "male" ? "👨 Men" : "🧑 Unknown / Other";
                    return (
                      <div key={gender}>
                        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{genderLabel} ({genderEmails.length} templates)</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">#</TableHead>
                              <TableHead>Subject</TableHead>
                              <TableHead className="w-[70px] text-right">Sent</TableHead>
                              <TableHead className="w-[70px] text-right">Opens</TableHead>
                              <TableHead className="w-[70px] text-right">Clicks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {genderEmails.map((email, i) => {
                              const stat = stepStats.find((s) => s.step === email.step);
                              return (
                                <TableRow key={email.id}>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[300px] truncate">{email.subject}</TableCell>
                                  <TableCell className="text-right">{stat?.sent || "—"}</TableCell>
                                  <TableCell className="text-right">{stat && stat.sent > 0 ? `${stat.openRate}%` : "—"}</TableCell>
                                  <TableCell className="text-right">{stat && stat.sent > 0 ? `${stat.clickRate}%` : "—"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Standard multi-step */
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Step</TableHead>
                      <TableHead className="w-[60px]">Day</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="w-[70px] text-right">Sent</TableHead>
                      <TableHead className="w-[70px] text-right">Failed</TableHead>
                      <TableHead className="w-[70px] text-right">Opens</TableHead>
                      <TableHead className="w-[70px] text-right">Clicks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaign.status === "draft"
                      ? campaign.emails.map((email) => (
                          <TableRow key={email.id}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {email.step + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {email.dayOffset}
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {email.subject}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                          </TableRow>
                        ))
                      : stepStats.map((stat) => (
                          <TableRow key={stat.step}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {stat.step + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {stat.dayOffset}
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {stat.subject}
                            </TableCell>
                            <TableCell className="text-right">{stat.sent}</TableCell>
                            <TableCell className="text-right text-red-600">
                              {stat.failed || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {stat.sent > 0 ? `${stat.openRate}%` : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {stat.sent > 0 ? `${stat.clickRate}%` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Single-email: Preview */}
        {!campaign.isMultiStep && campaign.bodyHtml && (
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
        )}

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

        {/* Delivery Log (first 100) */}
        {emailLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Delivery Log ({emailLogs.length}{emailLogs.length >= 200 ? "+" : ""})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    {campaign.isMultiStep && <TableHead>Step</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Clicked</TableHead>
                    <TableHead>Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">{log.to}</TableCell>
                      {campaign.isMultiStep && (
                        <TableCell>
                          {log.templateKey?.split("_").pop() === undefined
                            ? "—"
                            : `Step ${Number(log.templateKey?.split("_").pop()) + 1}`}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={log.status === "sent" ? "secondary" : "destructive"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.openedAt ? (
                          <span className="text-green-600" title={format(new Date(log.openedAt), "d MMM HH:mm")}>
                            Yes ({log.opensCount})
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.clickedAt ? (
                          <span className="text-blue-600" title={format(new Date(log.clickedAt), "d MMM HH:mm")}>
                            Yes ({log.clicksCount})
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(log.sentAt), "d MMM HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Delete (only drafts) */}
        {canDelete && (
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
    .replaceAll("{{firstName}}", "Jane")
    .replaceAll("{{unsubscribeUrl}}", "#");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="padding: 32px 24px;">${previewBody}</div>
  </div>
</body></html>`;
}
