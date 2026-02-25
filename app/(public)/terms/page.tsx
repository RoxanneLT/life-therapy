export const dynamic = "force-dynamic";
export const revalidate = 60;

import { getActiveDocument } from "@/lib/legal-documents";
import { buildStaticPageMetadata } from "@/lib/metadata";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/terms",
    "Terms & Conditions",
    "Terms & Conditions for Life Therapy coaching and counselling services, client portal, and website.",
    "/logo.png"
  );
}

export default async function TermsPage() {
  const doc = await getActiveDocument("terms");
  if (!doc) notFound();

  const sections = doc.content as { heading: string; content: string }[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-heading text-3xl font-bold">{doc.title}</h1>
      {doc.publishedAt && (
        <p className="mt-2 text-sm text-muted-foreground">
          Version {doc.version} &middot; Last updated:{" "}
          {format(new Date(doc.publishedAt), "MMMM yyyy")}
        </p>
      )}
      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            <p className="mt-2 whitespace-pre-line text-muted-foreground">
              {section.content}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
