import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface Agreement {
  slug: string;
  title: string;
  content: { heading: string; content: string }[];
  version: number;
  acceptedAt: string | null;
}

interface AgreementsTabProps {
  readonly agreements: Agreement[];
}

export function AgreementsTab({ agreements }: AgreementsTabProps) {
  const allAccepted = agreements.every((d) => d.acceptedAt);

  return (
    <div className="space-y-6">
      {allAccepted ? (
        <div className="flex items-start gap-3 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>All required documents have been accepted.</p>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Some documents need your review.{" "}
            <Link
              href="/portal/review-documents"
              className="font-medium underline hover:no-underline"
            >
              Review Now &rarr;
            </Link>
          </p>
        </div>
      )}

      {agreements.map((doc) => (
        <Card key={doc.slug}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{doc.title}</CardTitle>
              {doc.acceptedAt ? (
                <span className="flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accepted {format(new Date(doc.acceptedAt), "d MMM yyyy")}
                </span>
              ) : (
                <span className="text-xs text-amber-600">Pending</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {doc.content.map((section) => (
              <div key={section.heading}>
                <h3 className="mb-1 text-sm font-semibold">{section.heading}</h3>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {section.content}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
