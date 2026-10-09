import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";

// Legal documents live under Settings → Legal Documents, which renders the same client
// (./legal-documents-client). This route stays as a redirect so old links and bookmarks still land.
export default async function LegalDocumentsPage() {
  await requireAccess("/admin/legal-documents");
  redirect("/admin/settings/legal");
}
