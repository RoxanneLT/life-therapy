import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download Self-Esteem Snapshot | Life-Therapy",
  robots: { index: false, follow: false },
};

/**
 * /free/self-esteem-snapshot/download
 * Redirects to the landing page. The actual PDF download is served from
 * /downloads/self-esteem-snapshot.pdf — email CTAs link here so we can
 * track visits before redirecting to the full page experience.
 */
export default function DownloadRedirectPage() {
  redirect("/free/self-esteem-snapshot");
}
