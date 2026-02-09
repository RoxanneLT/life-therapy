export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { PackageForm } from "@/components/admin/package-form";
import { createPackage } from "../actions";

export default async function NewPackagePage() {
  await requireRole("super_admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Create Package</h1>
        <p className="text-sm text-muted-foreground">
          Add a new pick-your-own bundle with courses, digital products & session credits.
        </p>
      </div>
      <PackageForm onSubmit={createPackage} />
    </div>
  );
}
