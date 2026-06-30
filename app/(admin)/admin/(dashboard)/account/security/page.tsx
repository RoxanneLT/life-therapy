export const dynamic = "force-dynamic";

import { getAuthenticatedAdmin } from "@/lib/auth";
import { MfaSetup } from "@/components/admin/mfa-setup";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { KeyRound } from "lucide-react";

export default async function AdminSecurityPage() {
  await getAuthenticatedAdmin();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Security</h1>
        <p className="text-sm text-muted-foreground">
          Manage how you sign in to the admin.
        </p>
      </div>

      <MfaSetup />

      <div className="flex items-center justify-between rounded-md border bg-card p-4">
        <div>
          <p className="text-sm font-medium">Password</p>
          <p className="text-xs text-muted-foreground">Change your account password.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/users/change-password">
            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
            Change password
          </Link>
        </Button>
      </div>
    </div>
  );
}
