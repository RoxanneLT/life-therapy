"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { acceptUpdatedDocumentsAction } from "@/app/(portal)/portal/review-documents/actions";
import type { LegalDocumentSlug } from "@/lib/legal-documents";

interface DocumentData {
  slug: string;
  title: string;
  content: { heading: string; content: string }[];
  version: number;
  changeSummary: string | null;
}

interface DocumentUpdateModalProps {
  readonly documents: DocumentData[];
}

export function DocumentUpdateModal({ documents }: DocumentUpdateModalProps) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    startTransition(async () => {
      setError(null);
      try {
        const slugs = documents.map((d) => d.slug as LegalDocumentSlug);
        await acceptUpdatedDocumentsAction(slugs);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-background shadow-2xl">
        {/* Header */}
        <div className="border-b px-6 py-5">
          <h2 className="font-heading text-xl font-bold">
            We&apos;ve Updated Our Documents
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Please review the changes below and accept to continue.
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {documents.map((doc) => (
            <div key={doc.slug}>
              <h3 className="text-base font-semibold">{doc.title}</h3>
              {doc.changeSummary && (
                <p className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  What changed: {doc.changeSummary}
                </p>
              )}
              <div className="mt-3 space-y-4">
                {doc.content.map((section) => (
                  <div key={section.heading}>
                    <h4 className="mb-1 text-sm font-medium">
                      {section.heading}
                    </h4>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {section.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 space-y-3">
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="flex items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm font-medium">
              I have read and accept the updated{" "}
              {documents.map((d) => d.title).join(" and ")}
            </span>
          </label>

          <div className="flex justify-end">
            <Button onClick={handleAccept} disabled={!agreed || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept & Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
