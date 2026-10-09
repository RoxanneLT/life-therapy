export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { ClientImporter } from "./client-importer";
import { PageHeader } from "@/components/admin/page-header";

export default async function ImportClientsPage() {
  await requireRole("super_admin", "marketing");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <PageHeader
          back={{ href: "/admin/clients", to: "Clients" }}
          title="Import Clients"
        />
      </div>
      <ClientImporter />
    </div>
  );
}
