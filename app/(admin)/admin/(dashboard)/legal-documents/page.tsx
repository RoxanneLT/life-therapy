import { redirect } from "next/navigation";

// Legal documents live under Settings → Legal Documents, which renders the same client
// (./legal-documents-client). This route stays as a redirect so old links and bookmarks still land.
export default function LegalDocumentsPage() {
  redirect("/admin/settings/legal");
}
