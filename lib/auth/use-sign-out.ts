"use client";

import { useRouter } from "next/navigation";
import { signOutCompletely } from "./sign-out";

/**
 * Sign out and go to the login page.
 *
 * A hook rather than a plain function because the redirect needs the router, and the
 * admin and portal headers both wanted the same three lines around it — leaving two
 * byte-identical `handleSignOut` bodies even after the teardown itself was shared.
 * Collapsing only the inner half would have left the duplication check firing on a
 * wrapper, which is the sort of finding that teaches people to add allowlist entries.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  return async function signOut() {
    await signOutCompletely();
    router.push("/login");
    router.refresh();
  };
}
