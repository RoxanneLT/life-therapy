export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CartProvider } from "@/lib/cart-store";
import { GoogleAnalytics } from "@/components/google-analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getSiteSettings } from "@/lib/settings";
import { RegionProvider } from "@/lib/region-store";
import { getRegion, getCurrency } from "@/lib/get-region";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  const title = settings.metaTitle || "Life-Therapy | Personal Development & Life Coaching";
  const description = settings.metaDescription || "Transform your life with Roxanne Bouwer. Qualified life coach, counsellor & NLP practitioner offering online courses and 1:1 sessions.";

  return {
    title: {
      default: title,
      template: `%s | ${settings.siteName || "Life-Therapy"}`,
    },
    description,
    alternates: {
      languages: {
        "en-ZA": "https://life-therapy.co.za",
        "en": "https://life-therapy.online",
        "x-default": "https://life-therapy.online",
      },
    },
    openGraph: {
      title,
      description,
      ...(settings.ogImageUrl ? { images: [{ url: settings.ogImageUrl }] } : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const region = await getRegion();
  const currency = await getCurrency();

  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <RegionProvider region={region} currency={currency}>
            <CartProvider>
              {children}
              <Toaster position="top-right" />
            </CartProvider>
          </RegionProvider>
        </ThemeProvider>
        {settings.googleAnalyticsId && (
          <GoogleAnalytics gaId={settings.googleAnalyticsId} />
        )}
        <SpeedInsights />
      </body>
    </html>
  );
}
