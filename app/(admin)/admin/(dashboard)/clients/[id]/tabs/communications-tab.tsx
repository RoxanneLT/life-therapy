"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClientCommunications } from "../use-client-data";
import { CLIENT_QUERY_KEYS } from "@/lib/admin/query-keys";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  Plus,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import {
  updateCommPrefAction,
  pauseDripAction,
  resumeDripAction,
  resetDripAction,
  updateTagsAction,
} from "../actions";

interface DripData {
  currentPhase: string;
  currentStep: number;
  lastSentAt: string | null;
  completedAt: string | null;
  isPaused: boolean;
}

interface CampaignProgressData {
  id: string;
  lastSentAt: string | null;
  campaign: { name: string };
}

interface EmailLogData {
  id: string;
  subject: string;
  status: string;
  sentAt: string;
  openedAt: string | null;
  opensCount: number;
  clickedAt: string | null;
  clicksCount: number;
  templateKey: string | null;
}

interface CommunicationsTabProps {
  client: Record<string, unknown>;
}

const PREF_FIELDS = [
  {
    field: "newsletterOptIn",
    label: "Newsletter",
    onLabel: "Opted in",
    offLabel: "Not opted in",
  },
  {
    field: "marketingOptIn",
    label: "Marketing emails",
    onLabel: "Opted in",
    offLabel: "Not opted in",
  },
  {
    field: "smsOptIn",
    label: "WhatsApp reminders",
    onLabel: "Opted in",
    offLabel: "Not opted in",
  },
  {
    field: "sessionReminders",
    label: "Session reminders",
    onLabel: "Enabled",
    offLabel: "Disabled",
  },
  {
    field: "emailOptOut",
    label: "Global opt-out",
    onLabel: "Yes (all emails blocked)",
    offLabel: "No",
    inverted: true,
  },
] as const;

export function CommunicationsTab({ client }: CommunicationsTabProps) {
  const clientId = client.id as string;
  const queryClient = useQueryClient();
  const { data: commsData, isLoading } = useClientCommunications(clientId);

  const mergedClient = commsData ? { ...client, ...commsData } : client;
  const drip = mergedClient.dripProgress as DripData | null;
  const campaigns = (mergedClient.campaignProgress as CampaignProgressData[]) || [];
  const emailLogs = (mergedClient.emailLogs as EmailLogData[]) || [];
  const tags = ((mergedClient.tags as string[]) || []);

  function invalidateComms() {
    void queryClient.invalidateQueries({ queryKey: CLIENT_QUERY_KEYS.communications(clientId) });
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/4" />
        <div className="h-32 bg-muted rounded" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-lg font-semibold">Communications</h2>

      {/* Email Preferences */}
      <EmailPreferences client={mergedClient} clientId={clientId} onSuccess={invalidateComms} />

      {/* Drip Sequence */}
      <DripSection drip={drip} clientId={clientId} onSuccess={invalidateComms} />

      {/* Campaign History */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Campaign History
        </h3>
        {campaigns.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5">Campaign</th>
                      <th className="px-4 py-2.5">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((cp) => (
                      <tr key={cp.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5">{cp.campaign.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {cp.lastSentAt
                            ? format(new Date(cp.lastSentAt), "d MMM yyyy")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No campaigns sent.</p>
        )}
      </section>

      {/* Recent Emails */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Emails
        </h3>
        {emailLogs.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Subject</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                          {format(new Date(log.sentAt), "d MMM")}
                        </td>
                        <td className="max-w-xs truncate px-4 py-2.5">
                          {log.subject}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="secondary"
                            className={
                              log.status === "sent"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }
                          >
                            {log.status === "sent" ? "Sent" : "Failed"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {log.openedAt ? (
                            <span
                              className="text-green-600"
                              title={`Opened ${format(new Date(log.openedAt), "d MMM yyyy HH:mm")} · ${log.opensCount} open${log.opensCount !== 1 ? "s" : ""}`}
                            >
                              Yes
                              {log.clicksCount > 0 && (
                                <span className="ml-1 text-xs">
                                  · {log.clicksCount} click
                                  {log.clicksCount !== 1 ? "s" : ""}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No emails sent.</p>
        )}
      </section>

      {/* Tags */}
      <TagsSection tags={tags} clientId={clientId} onSuccess={invalidateComms} />
    </div>
  );
}

function EmailPreferences({
  client,
  clientId,
  onSuccess,
}: {
  client: Record<string, unknown>;
  clientId: string;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(field: string, currentValue: boolean) {
    startTransition(async () => {
      await updateCommPrefAction(clientId, field, !currentValue);
      onSuccess?.();
    });
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Email Preferences
      </h3>
      <Card>
        <CardContent className="divide-y py-0">
          {PREF_FIELDS.map((pref) => {
            const value = !!client[pref.field];
            const displayValue = "inverted" in pref && pref.inverted ? value : value;
            return (
              <div
                key={pref.field}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{pref.label}:</span>
                  {displayValue ? (
                    <span className="text-sm text-green-600">{pref.onLabel}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {pref.offLabel}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(pref.field, value)}
                  disabled={isPending}
                  className="text-xs"
                >
                  Toggle
                </Button>
              </div>
            );
          })}
          {/* Paused status — read only */}
          {!!client.emailPaused && (
            <div className="flex items-center gap-3 py-3">
              <span className="text-sm">Paused:</span>
              <span className="text-sm text-amber-600">
                Yes
                {client.emailPauseReason
                  ? ` — ${String(client.emailPauseReason)}`
                  : null}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function DripSection({
  drip,
  clientId,
  onSuccess,
}: {
  drip: DripData | null;
  clientId: string;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (!drip) {
    return (
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Drip Sequence
        </h3>
        <p className="text-sm text-muted-foreground">
          Not enrolled in drip sequence.
        </p>
      </section>
    );
  }

  const isComplete = !!drip.completedAt;

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Drip Sequence
      </h3>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">
                Phase:{" "}
                <strong className="capitalize">{drip.currentPhase}</strong> ·
                Step {drip.currentStep}
                {drip.lastSentAt && (
                  <>
                    {" "}
                    · Last sent:{" "}
                    {format(new Date(drip.lastSentAt), "d MMM")}
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Status:{" "}
                {isComplete ? (
                  <span className="text-green-600">Completed</span>
                ) : drip.isPaused ? (
                  <span className="text-amber-600">Paused</span>
                ) : (
                  <span className="text-green-600">Active</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {!isComplete &&
                (drip.isPaused ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => { await resumeDripAction(clientId); onSuccess?.(); })
                    }
                  >
                    <Play className="mr-1 h-3.5 w-3.5" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => { await pauseDripAction(clientId); onSuccess?.(); })
                    }
                  >
                    <Pause className="mr-1 h-3.5 w-3.5" />
                    Pause
                  </Button>
                ))}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isPending}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Reset
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Drip Sequence?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          This will restart the email sequence from step 1. The client will
                          receive all onboarding and nurture emails again from the beginning.
                        </p>
                        <p>
                          Only do this if the client is genuinely starting fresh — for
                          example, after a long break or if they joined as a new client
                          on a different email address.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => startTransition(async () => { await resetDripAction(clientId); onSuccess?.(); })}
                      disabled={isPending}
                    >
                      Yes, Reset Sequence
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function TagsSection({
  tags,
  clientId,
  onSuccess,
}: {
  tags: string[];
  clientId: string;
  onSuccess?: () => void;
}) {
  const [localTags, setLocalTags] = useState(tags);
  const [newTag, setNewTag] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || localTags.includes(tag)) return;
    const updated = [...localTags, tag];
    setLocalTags(updated);
    setNewTag("");
    startTransition(async () => { await updateTagsAction(clientId, updated); onSuccess?.(); });
  }

  function handleRemove(tag: string) {
    const updated = localTags.filter((t) => t !== tag);
    setLocalTags(updated);
    startTransition(async () => { await updateTagsAction(clientId, updated); onSuccess?.(); });
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Tags
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        {localTags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="ml-1 rounded-full p-0.5 hover:bg-muted"
              disabled={isPending}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag..."
            className="h-7 w-32 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            disabled={isPending || !newTag.trim()}
            className="h-7 px-2"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
