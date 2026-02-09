export const dynamic = "force-dynamic";

import { getPublicLayoutData } from "@/lib/public-layout-data";
import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { CookieConsent } from "@/components/public/cookie-consent";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings, navLinks, showBookButton, formattedHours, socialLinks } =
    await getPublicLayoutData();

  return (
    <>
      <PublicHeader
        navLinks={navLinks}
        showBookButton={showBookButton}
        logoUrl={settings.logoUrl}
      />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <PublicFooter
        tagline={settings.footerTagline || settings.tagline || ""}
        logoUrl={settings.logoUrl}
        email={settings.email || ""}
        phone={settings.phone || ""}
        whatsappNumber={settings.whatsappNumber || ""}
        businessHours={formattedHours}
        locationText={settings.locationText || ""}
        socialLinks={socialLinks}
        copyrightText={settings.copyrightText || ""}
      />
      <WhatsAppButton whatsappNumber={settings.whatsappNumber || "27710170353"} />
      <CookieConsent />
    </>
  );
}
