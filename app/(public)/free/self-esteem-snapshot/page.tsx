import { redirect } from "next/navigation";

/**
 * Legacy route — redirects to unified product page.
 * Drip emails and old links point here; this ensures they still work.
 */
export default function SelfEsteemSnapshotRedirect() {
  redirect("/products/self-esteem-snapshot");
}
