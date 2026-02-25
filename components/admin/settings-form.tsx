"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  Loader2,
  Palette,
  Phone,
  Share2,
  Search,
  Newspaper,
  Mail,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateSettings } from "@/app/(admin)/admin/(dashboard)/settings/actions";
import type { SiteSetting } from "@/lib/generated/prisma/client";
import type { BusinessHours } from "@/lib/settings";

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

const DEFAULT_HOURS: BusinessHours = {
  monday: { open: "09:00", close: "17:00", closed: false },
  tuesday: { open: "09:00", close: "17:00", closed: false },
  wednesday: { open: "09:00", close: "17:00", closed: false },
  thursday: { open: "09:00", close: "17:00", closed: false },
  friday: { open: "09:00", close: "17:00", closed: false },
  saturday: { open: "09:00", close: "13:00", closed: true },
  sunday: { open: "09:00", close: "13:00", closed: true },
};

interface SettingsSection {
  id: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: SettingsSection[] = [
  { id: "branding", label: "Branding", group: "General", icon: Palette },
  { id: "contact", label: "Contact & Hours", group: "General", icon: Phone },
  { id: "social", label: "Social Links", group: "General", icon: Share2 },
  { id: "seo", label: "SEO & Analytics", group: "General", icon: Search },
  { id: "email", label: "Email", group: "Integrations", icon: Mail },
  { id: "newsletter", label: "Newsletter", group: "Integrations", icon: Newspaper },
  { id: "payments", label: "Payments", group: "Integrations", icon: CreditCard },
  { id: "calendar", label: "Calendar", group: "Integrations", icon: Calendar },
];

const GROUPS = ["General", "Integrations"];

interface SecretStatus {
  msGraphConfigured: boolean;
  smtpConfigured: boolean;
  paystackConfigured: boolean;
  resendConfigured: boolean;
}

interface SettingsFormProps {
  initialSettings: SiteSetting;
  secretStatus: SecretStatus;
}

export function SettingsForm({ initialSettings, secretStatus }: SettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("branding");

  // Branding
  const [siteName, setSiteName] = useState(initialSettings.siteName);
  const [tagline, setTagline] = useState(initialSettings.tagline || "");
  const [logoUrl, setLogoUrl] = useState(initialSettings.logoUrl || "");

  // Footer
  const [copyrightText, setCopyrightText] = useState(initialSettings.copyrightText || "");
  const [footerTagline, setFooterTagline] = useState(initialSettings.footerTagline || "");

  // Contact
  const [email, setEmail] = useState(initialSettings.email || "");
  const [phone, setPhone] = useState(initialSettings.phone || "");
  const [whatsappNumber, setWhatsappNumber] = useState(initialSettings.whatsappNumber || "");
  const [locationText, setLocationText] = useState(initialSettings.locationText || "");

  // Business Hours
  const [businessHours, setBusinessHours] = useState<BusinessHours>(
    (initialSettings.businessHours as unknown as BusinessHours) || DEFAULT_HOURS
  );

  // Social
  const [facebookUrl, setFacebookUrl] = useState(initialSettings.facebookUrl || "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialSettings.linkedinUrl || "");
  const [instagramUrl, setInstagramUrl] = useState(initialSettings.instagramUrl || "");
  const [tiktokUrl, setTiktokUrl] = useState(initialSettings.tiktokUrl || "");
  const [youtubeUrl, setYoutubeUrl] = useState(initialSettings.youtubeUrl || "");

  // SEO
  const [metaTitle, setMetaTitle] = useState(initialSettings.metaTitle || "");
  const [metaDescription, setMetaDescription] = useState(initialSettings.metaDescription || "");
  const [ogImageUrl, setOgImageUrl] = useState(initialSettings.ogImageUrl || "");
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(initialSettings.googleAnalyticsId || "");

  // Email display preferences (non-secret — kept in DB)
  const [smtpFromName, setSmtpFromName] = useState(initialSettings.smtpFromName || "");
  const [smtpFromEmail, setSmtpFromEmail] = useState(initialSettings.smtpFromEmail || "");

  function updateHours(day: string, field: string, value: string | boolean) {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("siteName", siteName);
      formData.set("tagline", tagline);
      formData.set("logoUrl", logoUrl);
      formData.set("email", email);
      formData.set("phone", phone);
      formData.set("whatsappNumber", whatsappNumber);
      formData.set("locationText", locationText);
      formData.set("businessHours", JSON.stringify(businessHours));
      formData.set("facebookUrl", facebookUrl);
      formData.set("linkedinUrl", linkedinUrl);
      formData.set("instagramUrl", instagramUrl);
      formData.set("tiktokUrl", tiktokUrl);
      formData.set("youtubeUrl", youtubeUrl);
      formData.set("metaTitle", metaTitle);
      formData.set("metaDescription", metaDescription);
      formData.set("ogImageUrl", ogImageUrl);
      formData.set("googleAnalyticsId", googleAnalyticsId);
      formData.set("smtpFromName", smtpFromName);
      formData.set("smtpFromEmail", smtpFromEmail);
      formData.set("copyrightText", copyrightText);
      formData.set("footerTagline", footerTagline);

      await updateSettings(formData);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row md:h-[calc(100vh-10rem)] gap-6">
      {/* Mobile nav — horizontal scrollable strip */}
      <div className="md:hidden space-y-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your site branding, contact details, SEO, and integrations.
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b pb-px scrollbar-none">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px",
                  activeSection === section.id
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop sidebar — fixed in place, never scrolls */}
      <div className="hidden md:flex w-52 shrink-0 flex-col">
        <div className="mb-5">
          <h1 className="font-heading text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your site branding, contact details, SEO, and integrations.
          </p>
        </div>

        <nav className="flex-1 space-y-4">
          {GROUPS.map((group) => {
            const groupSections = SECTIONS.filter((s) => s.group === group);
            return (
              <div key={group}>
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {groupSections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                          activeSection === section.id
                            ? "bg-brand-50 text-brand-700"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {section.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t pt-4">
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Content area — scrolls independently */}
      <div className="min-w-0 flex-1 overflow-y-auto pr-1">
          {/* Branding */}
          {activeSection === "branding" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Branding</CardTitle>
                  <CardDescription>Site name, tagline, and logo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="siteName">Site Name</Label>
                    <Input id="siteName" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Textarea id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <ImageUpload value={logoUrl} onChange={setLogoUrl} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Footer</CardTitle>
                  <CardDescription>Content displayed in the website footer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="footerTagline">Footer Tagline</Label>
                    <Textarea id="footerTagline" value={footerTagline} onChange={(e) => setFooterTagline(e.target.value)} rows={2} placeholder="Online life coaching, counselling, and self-paced courses..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="copyrightText">Copyright Text</Label>
                    <Input id="copyrightText" value={copyrightText} onChange={(e) => setCopyrightText(e.target.value)} placeholder="©2026 All rights reserved by Life Therapy PTY Ltd." />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Contact & Hours */}
          {activeSection === "contact" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>Displayed on the website and in the footer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@life-therapy.co.za" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 71 017 0353" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsappNumber">WhatsApp Number (digits only)</Label>
                    <Input id="whatsappNumber" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="27710170353" />
                    <p className="text-xs text-muted-foreground">Used for the WhatsApp button and booking links. Country code + number, no spaces.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationText">Location / Availability</Label>
                    <Input id="locationText" value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="100% Online — South Africa based" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Business Hours</CardTitle>
                  <CardDescription>Set your opening and closing times for each day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {DAYS.map(({ key, label }) => {
                      const day = businessHours[key] || { open: "09:00", close: "17:00", closed: false };
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="w-28 text-sm font-medium">{label}</span>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!day.closed}
                              onCheckedChange={(checked) => updateHours(key, "closed", !checked)}
                            />
                            <span className="w-12 text-xs text-muted-foreground">{day.closed ? "Closed" : "Open"}</span>
                          </div>
                          {!day.closed && (
                            <>
                              <Input
                                type="time"
                                value={day.open}
                                onChange={(e) => updateHours(key, "open", e.target.value)}
                                className="w-32"
                              />
                              <span className="text-sm text-muted-foreground">to</span>
                              <Input
                                type="time"
                                value={day.close}
                                onChange={(e) => updateHours(key, "close", e.target.value)}
                                className="w-32"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Social Links */}
          {activeSection === "social" && (
            <Card>
              <CardHeader>
                <CardTitle>Social Links</CardTitle>
                <CardDescription>Links to your social media profiles. Leave blank to hide.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="facebookUrl">Facebook</Label>
                  <Input id="facebookUrl" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl">LinkedIn</Label>
                  <Input id="linkedinUrl" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagramUrl">Instagram</Label>
                  <Input id="instagramUrl" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktokUrl">TikTok</Label>
                  <Input id="tiktokUrl" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtubeUrl">YouTube</Label>
                  <Input id="youtubeUrl" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@..." />
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEO */}
          {activeSection === "seo" && (
            <Card>
              <CardHeader>
                <CardTitle>SEO & Analytics</CardTitle>
                <CardDescription>Default meta tags and Google Analytics tracking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="metaTitle">Default Meta Title</Label>
                  <Input id="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Life-Therapy | Online Coaching & Courses" />
                  <p className="text-xs text-muted-foreground">Used when pages don&apos;t have their own title.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metaDescription">Default Meta Description</Label>
                  <Textarea id="metaDescription" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3} placeholder="Online life coaching, counselling, and self-paced courses..." />
                </div>
                <div className="space-y-2">
                  <Label>OG Image (Social Sharing)</Label>
                  <ImageUpload value={ogImageUrl} onChange={setOgImageUrl} />
                  <p className="text-xs text-muted-foreground">Recommended size: 1200x630px. Used when shared on social media.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="googleAnalyticsId">Google Analytics Measurement ID</Label>
                  <Input id="googleAnalyticsId" value={googleAnalyticsId} onChange={(e) => setGoogleAnalyticsId(e.target.value)} placeholder="G-XXXXXXXXXX" />
                  <p className="text-xs text-muted-foreground">Leave blank to disable tracking.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Email */}
          {activeSection === "email" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Providers</CardTitle>
                  <CardDescription>Email credentials are configured via environment variables for security.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    {secretStatus.resendConfigured ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">Resend (Primary)</p>
                      <p className="text-xs text-muted-foreground">
                        {secretStatus.resendConfigured ? "Configured via RESEND_API_KEY" : "Not configured — set RESEND_API_KEY in environment"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    {secretStatus.smtpConfigured ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">SMTP (Fallback)</p>
                      <p className="text-xs text-muted-foreground">
                        {secretStatus.smtpConfigured ? "Configured via SMTP_HOST, SMTP_USER" : "Not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in environment"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sender Identity</CardTitle>
                  <CardDescription>Display name and email shown in outgoing messages</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="smtpFromName">From Name</Label>
                      <Input id="smtpFromName" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} placeholder="Life-Therapy" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpFromEmail">From Email</Label>
                      <Input id="smtpFromEmail" type="email" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} placeholder="noreply@life-therapy.co.za" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Newsletter */}
          {activeSection === "newsletter" && (
            <Card>
              <CardHeader>
                <CardTitle>Newsletter</CardTitle>
                <CardDescription>Newsletter subscriptions are stored locally in the database.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The footer newsletter form saves subscribers directly to the Contacts database. You can manage contacts, import subscribers, and send campaigns from the admin panel.
                </p>
                <Link
                  href="/admin/contacts"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline"
                >
                  Manage Contacts &rarr;
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Payments */}
          {activeSection === "payments" && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Provider</CardTitle>
                <CardDescription>Payment credentials are configured via environment variables for security.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  {secretStatus.paystackConfigured ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Paystack</p>
                    <p className="text-xs text-muted-foreground">
                      {secretStatus.paystackConfigured ? "Configured via PAYSTACK_SECRET_KEY" : "Not configured — set PAYSTACK_SECRET_KEY in environment"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calendar (MS Graph) */}
          {activeSection === "calendar" && (
            <Card>
              <CardHeader>
                <CardTitle>Microsoft Graph (Calendar)</CardTitle>
                <CardDescription>Calendar and Teams integration credentials are configured via environment variables.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  {secretStatus.msGraphConfigured ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Microsoft Graph API</p>
                    <p className="text-xs text-muted-foreground">
                      {secretStatus.msGraphConfigured
                        ? "Configured via MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_USER_EMAIL"
                        : "Not configured — set MS_GRAPH_* environment variables"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        {/* Mobile save button */}
        <div className="mt-6 border-t pt-4 md:hidden">
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
        </div>
    </form>
  );
}
