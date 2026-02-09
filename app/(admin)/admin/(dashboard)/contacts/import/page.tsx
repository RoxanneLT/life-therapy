export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { ContactImporter } from "./contact-importer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ImportContactsPage() {
  await requireRole("super_admin", "marketing");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/contacts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contacts
      </Link>

      <h1 className="mb-6 font-heading text-2xl font-bold">Import Contacts</h1>
      <ContactImporter />
    </div>
  );
}
