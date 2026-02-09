export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDripPhaseCounts } from "@/lib/drip-emails";
import {
  updateContactAction,
  deleteContactAction,
  pauseDripAction,
  resumeDripAction,
  resetDripAction,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, ExternalLink, Trash2, Pause, Play, RotateCcw } from "lucide-react";
import { format } from "date-fns";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin", "marketing");
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      dripProgress: true,
    },
  });

  if (!contact) notFound();

  const emailLogs = await prisma.emailLog.findMany({
    where: { to: contact.email },
    orderBy: { sentAt: "desc" },
    take: 20,
  });

  const tags = (contact.tags as string[]) || [];

  // Drip progress info
  const drip = contact.dripProgress;
  let currentDripEmail: { subject: string } | null = null;
  if (drip && !drip.completedAt) {
    currentDripEmail = await prisma.dripEmail.findUnique({
      where: { type_step: { type: drip.currentPhase, step: drip.currentStep } },
      select: { subject: true },
    });
  }
  const phaseCounts = await getDripPhaseCounts();
  const dripTotalSteps = drip?.currentPhase === "newsletter" ? phaseCounts.newsletter : phaseCounts.onboarding;
  const dripProgressPct = drip
    ? drip.completedAt
      ? 100
      : Math.round((drip.currentStep / dripTotalSteps) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/contacts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contacts
      </Link>

      <div className="grid gap-6">
        {/* Edit Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email}
              </CardTitle>
              <div className="flex gap-2">
                {contact.emailOptOut ? (
                  <Badge variant="destructive">Unsubscribed</Badge>
                ) : contact.consentGiven ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Subscribed</Badge>
                ) : (
                  <Badge variant="outline">No consent</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form action={updateContactAction} className="space-y-4">
              <input type="hidden" name="id" value={contact.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" defaultValue={contact.firstName || ""} />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" defaultValue={contact.lastName || ""} />
                </div>
              </div>

              <div>
                <Label>Email</Label>
                <Input value={contact.email} disabled className="bg-muted" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={contact.phone || ""} />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    name="gender"
                    defaultValue={contact.gender || ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— Select —</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input id="tags" name="tags" defaultValue={tags.join(", ")} />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} defaultValue={contact.notes || ""} />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emailOptOut"
                  name="emailOptOut"
                  defaultChecked={contact.emailOptOut}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="emailOptOut" className="text-sm font-normal">
                  Opted out of marketing emails
                </Label>
              </div>

              <Button type="submit">Save Changes</Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <Badge variant="outline">{contact.source}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consent given</span>
              <span>{contact.consentGiven ? "Yes" : "No"}</span>
            </div>
            {contact.consentDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Consent date</span>
                <span>{format(new Date(contact.consentDate), "d MMM yyyy")}</span>
              </div>
            )}
            {contact.consentMethod && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Consent method</span>
                <span>{contact.consentMethod}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(contact.createdAt), "d MMM yyyy HH:mm")}</span>
            </div>
            {contact.student && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Linked student</span>
                <Link
                  href={`/admin/students/${contact.student.id}`}
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                >
                  {contact.student.firstName} {contact.student.lastName}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email History */}
        {emailLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="max-w-[200px] truncate">{log.subject}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.templateKey || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === "sent" ? "secondary" : "destructive"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(log.sentAt), "d MMM yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Drip Email Progress */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Drip Email Progress</CardTitle>
              {drip?.completedAt ? (
                <Badge className="bg-green-100 text-green-800">Completed</Badge>
              ) : drip?.isPaused ? (
                <Badge variant="secondary">Paused</Badge>
              ) : drip ? (
                <Badge variant="outline" className="capitalize">{drip.currentPhase}</Badge>
              ) : (
                <Badge variant="outline">Not Started</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {drip ? (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phase</span>
                    <span className="capitalize">{drip.currentPhase}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Step</span>
                    <span>
                      {drip.completedAt
                        ? `${dripTotalSteps} of ${dripTotalSteps}`
                        : `${drip.currentStep} of ${dripTotalSteps}`}
                    </span>
                  </div>
                  {currentDripEmail && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next email</span>
                      <span className="max-w-[200px] truncate text-right">{currentDripEmail.subject}</span>
                    </div>
                  )}
                  {drip.lastSentAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last sent</span>
                      <span>{format(new Date(drip.lastSentAt), "d MMM yyyy HH:mm")}</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{dripProgressPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${dripProgressPct}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {!drip.completedAt && (
                    drip.isPaused ? (
                      <form action={resumeDripAction}>
                        <input type="hidden" name="contactId" value={contact.id} />
                        <Button variant="outline" size="sm" type="submit">
                          <Play className="mr-2 h-4 w-4" />
                          Resume
                        </Button>
                      </form>
                    ) : (
                      <form action={pauseDripAction}>
                        <input type="hidden" name="contactId" value={contact.id} />
                        <Button variant="outline" size="sm" type="submit">
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                      </form>
                    )
                  )}
                  <form action={resetDripAction}>
                    <input type="hidden" name="contactId" value={contact.id} />
                    <Button variant="outline" size="sm" type="submit">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This contact has not entered the drip sequence yet. The cron job will create a progress
                record on its next run if the contact has consent and has not opted out.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Delete */}
        <Card className="border-destructive/30">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium text-destructive">Delete Contact</p>
              <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            </div>
            <form action={deleteContactAction}>
              <input type="hidden" name="id" value={contact.id} />
              <Button variant="destructive" size="sm" type="submit">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
