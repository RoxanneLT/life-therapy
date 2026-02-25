"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { acceptUpdatedDocumentsAction } from "./actions";
import type { LegalDocumentSlug } from "@/lib/legal-documents";

interface DocumentData {
  slug: string;
  title: string;
  content: { heading: string; content: string }[];
  version: number;
  changeSummary: string | null;
}

interface ReviewDocumentsClientProps {
  readonly documents: DocumentData[];
}

export function ReviewDocumentsClient({ documents }: ReviewDocumentsClientProps) {
  const [agreed, setAgreed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    startTransition(async () => {
      setError(null);
      try {
        const slugs = documents.map((d) => d.slug as LegalDocumentSlug);
        await acceptUpdatedDocumentsAction(slugs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-6">
      {documents.map((doc) => (
        <Card key={doc.slug}>
          <CardHeader>
            <CardTitle className="text-base">{doc.title}</CardTitle>
            {doc.changeSummary && (
              <p className="text-sm text-amber-600">
                What changed: {doc.changeSummary}
              </p>
            )}
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

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="flex items-start gap-3 rounded-md border p-4">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm font-medium">
          I have read and accept the updated{" "}
          {documents.map((d) => d.title).join(" and ")}
        </span>
      </label>

      <div className="flex justify-end">
        <Button onClick={handleAccept} disabled={!agreed || isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
}
