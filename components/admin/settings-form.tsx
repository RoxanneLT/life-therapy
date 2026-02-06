"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/admin/image-upload";
import { Loader2 } from "lucide-react";
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

interface SettingsFormProps {
  initialSettings: SiteSetting;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [saving, setSaving] = useState(false);

  // Branding
  const [siteName, setSiteName] = useState(initialSettings.siteName);
  const [tagline, setTagline] = useState(initialSettings.tagline || "");
  const [logoUrl, setLogoUrl] = useState(initialSettings.logoUrl || "");

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

  // Newsletter
  const [mailchimpApiKey, setMailchimpApiKey] = useState(initialSettings.mailchimpApiKey || "");
  const [mailchimpAudienceId, setMailchimpAudienceId] = useState(initialSettings.mailchimpAudienceId || "");
  const [mailchimpServer, setMailchimpServer] = useState(initialSettings.mailchimpServer || "");

  // SMTP
  const [smtpHost, setSmtpHost] = useState(initialSettings.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState(initialSettings.smtpPort?.toString() || "");
  const [smtpUser, setSmtpUser] = useState(initialSettings.smtpUser || "");
  const [smtpPass, setSmtpPass] = useState(initialSettings.smtpPass || "");
  const [smtpFromName, setSmtpFromName] = useState(initialSettings.smtpFromName || "");
  const [smtpFromEmail, setSmtpFromEmail] = useState(initialSettings.smtpFromEmail || "");

  // Footer
  const [copyrightText, setCopyrightText] = useState(initialSettings.copyrightText || "");
  const [footerTagline, setFooterTagline] = useState(initialSettings.footerTagline || "");

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
      formData.set("mailchimpApiKey", mailchimpApiKey);
      formData.set("mailchimpAudienceId", mailchimpAudienceId);
      formData.set("mailchimpServer", mailchimpServer);
      formData.set("smtpHost", smtpHost);
      formData.set("smtpPort", smtpPort);
      formData.set("smtpUser", smtpUser);
      formData.set("smtpPass", smtpPass);
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
    <form onSubmit={handleSubmit}>
      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="hours">Business Hours</TabsTrigger>
          <TabsTrigger value="social">Social Links</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
          <TabsTrigger value="email">Email (SMTP)</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
        </TabsList>

        {/* Branding */}
        <TabsContent value="branding">
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
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact">
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
        </TabsContent>

        {/* Business Hours */}
        <TabsContent value="hours">
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
        </TabsContent>

        {/* Social Links */}
        <TabsContent value="social">
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
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo">
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
        </TabsContent>

        {/* Newsletter */}
        <TabsContent value="newsletter">
          <Card>
            <CardHeader>
              <CardTitle>Newsletter (Mailchimp)</CardTitle>
              <CardDescription>Connect Mailchimp to enable the footer newsletter signup form</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mailchimpApiKey">API Key</Label>
                <Input id="mailchimpApiKey" type="password" value={mailchimpApiKey} onChange={(e) => setMailchimpApiKey(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us21" />
                <p className="text-xs text-muted-foreground">
                  Found in Mailchimp &rarr; Account &rarr; Extras &rarr; API keys.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mailchimpAudienceId">Audience (List) ID</Label>
                  <Input id="mailchimpAudienceId" value={mailchimpAudienceId} onChange={(e) => setMailchimpAudienceId(e.target.value)} placeholder="abc1234567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mailchimpServer">Server Prefix</Label>
                  <Input id="mailchimpServer" value={mailchimpServer} onChange={(e) => setMailchimpServer(e.target.value)} placeholder="us21" />
                  <p className="text-xs text-muted-foreground">The part after the dash in your API key.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP */}
        <TabsContent value="email">
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
        </TabsContent>

        {/* Footer */}
        <TabsContent value="footer">
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
        </TabsContent>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </Tabs>
    </form>
  );
}
