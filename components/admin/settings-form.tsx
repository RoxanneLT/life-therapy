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
  DollarSign,
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
  { id: "email", label: "Email (SMTP)", group: "Integrations", icon: Mail },
  { id: "newsletter", label: "Newsletter", group: "Integrations", icon: Newspaper },
  { id: "payments", label: "Payments", group: "Integrations", icon: CreditCard },
  { id: "session-pricing", label: "Session Pricing", group: "Pricing", icon: DollarSign },
];

const GROUPS = ["General", "Integrations", "Pricing"];

interface SettingsFormProps {
  initialSettings: SiteSetting;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
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

  // SMTP
  const [smtpHost, setSmtpHost] = useState(initialSettings.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState(initialSettings.smtpPort?.toString() || "");
  const [smtpUser, setSmtpUser] = useState(initialSettings.smtpUser || "");
  const [smtpPass, setSmtpPass] = useState(initialSettings.smtpPass || "");
  const [smtpFromName, setSmtpFromName] = useState(initialSettings.smtpFromName || "");
  const [smtpFromEmail, setSmtpFromEmail] = useState(initialSettings.smtpFromEmail || "");

  // Payments (Stripe)
  const [stripeSecretKey, setStripeSecretKey] = useState(initialSettings.stripeSecretKey || "");
  const [stripePublishableKey, setStripePublishableKey] = useState(initialSettings.stripePublishableKey || "");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState(initialSettings.stripeWebhookSecret || "");

  // Session Pricing (all currencies)
  const [sessionPriceIndividualZar, setSessionPriceIndividualZar] = useState(initialSettings.sessionPriceIndividualZar?.toString() || "");
  const [sessionPriceIndividualUsd, setSessionPriceIndividualUsd] = useState(initialSettings.sessionPriceIndividualUsd?.toString() || "");
  const [sessionPriceIndividualEur, setSessionPriceIndividualEur] = useState(initialSettings.sessionPriceIndividualEur?.toString() || "");
  const [sessionPriceIndividualGbp, setSessionPriceIndividualGbp] = useState(initialSettings.sessionPriceIndividualGbp?.toString() || "");
  const [sessionPriceCouplesZar, setSessionPriceCouplesZar] = useState(initialSettings.sessionPriceCouplesZar?.toString() || "");
  const [sessionPriceCouplesUsd, setSessionPriceCouplesUsd] = useState(initialSettings.sessionPriceCouplesUsd?.toString() || "");
  const [sessionPriceCouplesEur, setSessionPriceCouplesEur] = useState(initialSettings.sessionPriceCouplesEur?.toString() || "");
  const [sessionPriceCouplesGbp, setSessionPriceCouplesGbp] = useState(initialSettings.sessionPriceCouplesGbp?.toString() || "");

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
      formData.set("smtpHost", smtpHost);
      formData.set("smtpPort", smtpPort);
      formData.set("smtpUser", smtpUser);
      formData.set("smtpPass", smtpPass);
      formData.set("smtpFromName", smtpFromName);
      formData.set("smtpFromEmail", smtpFromEmail);
      formData.set("stripeSecretKey", stripeSecretKey);
      formData.set("stripePublishableKey", stripePublishableKey);
      formData.set("stripeWebhookSecret", stripeWebhookSecret);
      formData.set("sessionPriceIndividualZar", sessionPriceIndividualZar);
      formData.set("sessionPriceIndividualUsd", sessionPriceIndividualUsd);
      formData.set("sessionPriceIndividualEur", sessionPriceIndividualEur);
      formData.set("sessionPriceIndividualGbp", sessionPriceIndividualGbp);
      formData.set("sessionPriceCouplesZar", sessionPriceCouplesZar);
      formData.set("sessionPriceCouplesUsd", sessionPriceCouplesUsd);
      formData.set("sessionPriceCouplesEur", sessionPriceCouplesEur);
      formData.set("sessionPriceCouplesGbp", sessionPriceCouplesGbp);
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
    <form onSubmit={handleSubmit} className="flex h-[calc(100vh-7rem)] gap-6">
      {/* Sidebar — fixed in place, never scrolls */}
      <div className="flex w-52 shrink-0 flex-col">
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

          {/* SMTP */}
          {activeSection === "email" && (
            <Card>
              <CardHeader>
                <CardTitle>Email (SMTP)</CardTitle>
                <CardDescription>Configure SMTP for sending transactional emails (booking confirmations, contact form, etc.)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtpHost">SMTP Host</Label>
                    <Input id="smtpHost" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPort">SMTP Port</Label>
                    <Input id="smtpPort" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtpUser">Username</Label>
                    <Input id="smtpUser" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="your@email.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPass">Password</Label>
                    <Input id="smtpPass" type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="App password or SMTP password" />
                  </div>
                </div>
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
                <CardTitle>Stripe Payment Settings</CardTitle>
                <CardDescription>Configure Stripe for online payments. Use test keys for development.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stripePublishableKey">Publishable Key</Label>
                  <Input id="stripePublishableKey" value={stripePublishableKey} onChange={(e) => setStripePublishableKey(e.target.value)} placeholder="pk_test_..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stripeSecretKey">Secret Key</Label>
                  <Input id="stripeSecretKey" type="password" value={stripeSecretKey} onChange={(e) => setStripeSecretKey(e.target.value)} placeholder="sk_test_..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stripeWebhookSecret">Webhook Secret</Label>
                  <Input id="stripeWebhookSecret" type="password" value={stripeWebhookSecret} onChange={(e) => setStripeWebhookSecret(e.target.value)} placeholder="whsec_..." />
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Environment variables (STRIPE_SECRET_KEY, etc.) take priority over these settings. Use this for admin-configurable keys.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Session Pricing */}
          {activeSection === "session-pricing" && (
            <Card>
              <CardHeader>
                <CardTitle>Session Pricing</CardTitle>
                <CardDescription>Set session prices for all currencies. All values are in cents (e.g. 85000 = R850.00, 6500 = $65.00).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="mb-3 text-sm font-medium">Individual Session (60 min)</h4>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="sessionPriceIndividualZar">ZAR (cents)</Label>
                      <Input id="sessionPriceIndividualZar" type="number" value={sessionPriceIndividualZar} onChange={(e) => setSessionPriceIndividualZar(e.target.value)} placeholder="e.g. 85000 = R850" min={0} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sessionPriceIndividualUsd">USD (cents)</Label>
                      <Input id="sessionPriceIndividualUsd" type="number" value={sessionPriceIndividualUsd} onChange={(e) => setSessionPriceIndividualUsd(e.target.value)} placeholder="e.g. 6500 = $65" min={0} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sessionPriceIndividualEur">EUR (cents)</Label>
                      <Input id="sessionPriceIndividualEur" type="number" value={sessionPriceIndividualEur} onChange={(e) => setSessionPriceIndividualEur(e.target.value)} placeholder="e.g. 5900 = €59" min={0} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sessionPriceIndividualGbp">GBP (cents)</Label>
                      <Input id="sessionPriceIndividualGbp" type="number" value={sessionPriceIndividualGbp} onChange={(e) => setSessionPriceIndividualGbp(e.target.value)} placeholder="e.g. 4900 = £49" min={0} />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-medium">Couples Session (60 min)</h4>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="sessionPriceCouplesZar">ZAR (cents)</Label>
                      <Input id="sessionPriceCouplesZar" type="number" value={sessionPriceCouplesZar} onChange={(e) => setSessionPriceCouplesZar(e.target.value)} placeholder="e.g. 120000 = R1,200" min={0} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sessionPriceCouplesUsd">USD (cents)</Label>
                      <Input id="sessionPriceCouplesUsd" type="number" value={sessionPriceCouplesUsd} onChange={(e) => setSessionPriceCouplesUsd(e.target.value)} placeholder="e.g. 9500 = $95" min={0} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sessionPriceCouplesEur">EUR (cents)</Label>
                      <Input id="sessionPriceCouplesEur" type="number" value={sessionPriceCouplesEur} onChange={(e) => setSessionPriceCouplesEur(e.target.value)} placeholder="e.g. 8500 = €85" min={0} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sessionPriceCouplesGbp">GBP (cents)</Label>
                      <Input id="sessionPriceCouplesGbp" type="number" value={sessionPriceCouplesGbp} onChange={(e) => setSessionPriceCouplesGbp(e.target.value)} placeholder="e.g. 7500 = £75" min={0} />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Free consultations are always free regardless of currency. Leave a field blank to use the default price.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
    </form>
  );
}
