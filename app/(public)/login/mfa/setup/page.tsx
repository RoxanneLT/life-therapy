export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAuthenticatedAdmin } from "@/lib/auth";
import { MfaSetup } from "@/components/admin/mfa-setup";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

/**
 * Mandatory 2FA enrolment. The admin gate redirects any admin with no verified
 * factor here. It lives under the public /login layout (centred card), OUTSIDE
 * the dashboard layout — so the gate doesn't run here and can't loop.
 *
 * skipMfaGate: true verifies the admin is signed in without re-triggering the
 * gate. Once they enrol a factor the session steps up to AAL2, so "Continue"
 * passes the gate; clicking it before enrolling just bounces back here.
 */
export default async function MfaSetupRequiredPage() {
  await getAuthenticatedAdmin({ skipMfaGate: true });

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4" />
          Two-factor authentication is required
        </div>
        <p className="mt-1 text-amber-800 dark:text-amber-300/90">
          Admin accounts must have 2FA enabled. Set up at least one method below to continue.
        </p>
      </div>

      <MfaSetup />

      <Button asChild className="w-full">
        <Link href="/admin">Continue to admin →</Link>
      </Button>
    </div>
  );
}
