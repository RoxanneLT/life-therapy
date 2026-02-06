import { getPublicLayoutData } from "@/lib/public-layout-data";
import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";

export default async function PortalAuthLayout({
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
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-brand-50 via-cream-50 to-brand-100 py-12 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
        {children}
      </main>
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
        mailchimpConfigured={!!(settings.mailchimpApiKey && settings.mailchimpAudienceId && settings.mailchimpServer)}
      />
    </>
  );
}
