"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acceptDocument, type LegalDocumentSlug } from "@/lib/legal-documents";

export async function acceptUpdatedDocumentsAction(slugs: LegalDocumentSlug[]) {
  const { student } = await getAuthenticatedStudent();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headersList.get("x-real-ip") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  for (const slug of slugs) {
    await acceptDocument(student.id, slug, ip, userAgent);
  }

  revalidatePath("/portal");
  redirect("/portal");
}
