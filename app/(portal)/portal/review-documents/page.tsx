export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { redirect } from "next/navigation";
import {
  getOutstandingDocuments,
  getActiveDocument,
} from "@/lib/legal-documents";
import { ReviewDocumentsClient } from "./review-documents-client";

export default async function ReviewDocumentsPage() {
  const { student } = await requirePasswordChanged();

  const outstanding = await getOutstandingDocuments(student.id);

  // If nothing outstanding, go back to portal
  if (outstanding.length === 0) {
    redirect("/portal");
  }

  // Fetch full content for each outstanding document
  const docs = await Promise.all(
    outstanding.map((slug) => getActiveDocument(slug))
  );

  const documents = docs
    .filter(Boolean)
    .map((doc) => ({
      slug: doc!.slug,
      title: doc!.title,
      content: doc!.content as { heading: string; content: string }[],
      version: doc!.version,
      changeSummary: doc!.changeSummary,
    }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Updated Documents — Please Review
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One or more documents have been updated since your last acceptance.
          Please review and accept to continue.
        </p>
      </div>
      <ReviewDocumentsClient documents={documents} />
    </div>
  );
}
