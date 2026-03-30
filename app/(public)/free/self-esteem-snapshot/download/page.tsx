import { redirect } from "next/navigation";

/**
 * Legacy download route — redirects to unified product page.
 */
export default function DownloadRedirectPage() {
  redirect("/products/self-esteem-snapshot");
}
