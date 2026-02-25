"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface DocumentAcceptanceRow {
  id: string;
  documentSlug: string;
  documentVersion: number;
  ipAddress: string | null;
  userAgent: string | null;
  acceptedAt: string;
  document: { title: string };
}

interface LegacyAck {
  id: string;
  version: string;
  ipAddress: string | null;
  userAgent: string | null;
  acknowledgedAt: string;
}

interface CommitmentTabProps {
  readonly client: Record<string, unknown>;
}

function maskIp(ip: string | null): string {
  if (!ip) return "\u2014";
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.xxx.xxx`;
  return ip.length > 12 ? `${ip.substring(0, 12)}...` : ip;
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return "\u2014";
  let browser = "Unknown browser";
  let os = "Unknown OS";

  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} on ${os}`;
}

// Merge new document acceptances + legacy commitment acks into unified timeline
function buildAuditTrail(
  docAcceptances: DocumentAcceptanceRow[],
  legacyAcks: LegacyAck[]
) {
  const entries: {
    id: string;
    label: string;
    version: string;
    ipAddress: string | null;
    userAgent: string | null;
    date: string;
    legacy: boolean;
  }[] = [];

  // Add new-system acceptances
  for (const a of docAcceptances) {
    entries.push({
      id: a.id,
      label: a.document.title,
      version: `v${a.documentVersion}`,
      ipAddress: a.ipAddress,
      userAgent: a.userAgent,
      date: a.acceptedAt,
      legacy: false,
    });
  }

  // Add legacy acks that don't have a corresponding new-system row
  // (defensive: migration should have copied them, but just in case)
  for (const ack of legacyAcks) {
    const alreadyMigrated = docAcceptances.some(
      (a) =>
        a.documentSlug === "commitment" &&
        new Date(a.acceptedAt).getTime() ===
          new Date(ack.acknowledgedAt).getTime()
    );
    if (!alreadyMigrated) {
      entries.push({
        id: ack.id,
        label: "Commitment Agreement",
        version: ack.version,
        ipAddress: ack.ipAddress,
        userAgent: ack.userAgent,
        date: ack.acknowledgedAt,
        legacy: true,
      });
    }
  }

  // Sort by date descending
  entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return entries;
}

export function CommitmentTab({ client }: CommitmentTabProps) {
  const docAcceptances =
    (client.documentAcceptances as DocumentAcceptanceRow[]) || [];
  const legacyAcks = (client.commitmentAcks as LegacyAck[]) || [];
  const auditTrail = buildAuditTrail(docAcceptances, legacyAcks);

  // Group current acceptances by document slug
  const latestBySlug: Record<string, DocumentAcceptanceRow> = {};
  for (const a of docAcceptances) {
    const existing = latestBySlug[a.documentSlug];
    if (
      !existing ||
      new Date(a.acceptedAt).getTime() >
        new Date(existing.acceptedAt).getTime()
    ) {
      latestBySlug[a.documentSlug] = a;
    }
  }

  const requiredDocs = ["commitment", "terms"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Agreements</h2>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/legal-documents">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Manage Documents
          </Link>
        </Button>
      </div>

      {/* Acceptance status per required document */}
      <div className="grid gap-3 sm:grid-cols-2">
        {requiredDocs.map((slug) => {
          const acceptance = latestBySlug[slug];
          const title =
            slug === "commitment"
              ? "Commitment Agreement"
              : "Terms & Conditions";

          return (
            <Card key={slug}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{title}</p>
                  {acceptance ? (
                    <p className="text-xs text-muted-foreground">
                      v{acceptance.documentVersion} &middot; Accepted{" "}
                      {format(
                        new Date(acceptance.acceptedAt),
                        "d MMM yyyy"
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Not yet accepted
                    </p>
                  )}
                </div>
                {acceptance ? (
                  <Badge className="bg-green-100 text-green-700">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Accepted
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                    Pending
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Audit Trail */}
      {auditTrail.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Acceptance History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {auditTrail.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 border-l-2 border-brand-200 pl-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <Badge variant="outline" className="shrink-0">
                        {entry.version}
                      </Badge>
                      {entry.legacy && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          legacy
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(
                        new Date(entry.date),
                        "d MMM yyyy 'at' HH:mm"
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      IP: {maskIp(entry.ipAddress)} &middot;{" "}
                      {parseUserAgent(entry.userAgent)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {auditTrail.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No document acceptances recorded for this client.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
