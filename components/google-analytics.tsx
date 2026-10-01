"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

interface GoogleAnalyticsProps {
  readonly gaId: string;
}

/**
 * Pages whose URL carries a secret. GA's page_view sends the full URL, query string included, so
 * on these pages it is not loaded at all: /buy/thank-you?reference=… serves a paid download on that
 * reference. Landing on one of these first and moving on loads GA on the next page, with that
 * page's clean URL.
 */
const NO_ANALYTICS = ["/buy/thank-you"];

export function GoogleAnalytics({ gaId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  if (NO_ANALYTICS.some((p) => pathname?.startsWith(p))) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
