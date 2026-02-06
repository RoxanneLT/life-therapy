"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Facebook, Linkedin, Mail, Phone, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  linkedin: Linkedin,
  instagram: Instagram,
};

interface PublicFooterProps {
  readonly tagline: string;
  readonly logoUrl?: string | null;
  readonly email: string;
  readonly phone: string;
  readonly whatsappNumber: string;
  readonly businessHours: string;
  readonly locationText: string;
  readonly socialLinks: { platform: string; url: string }[];
  readonly copyrightText: string;
  readonly mailchimpConfigured: boolean;
}

export function PublicFooter({
  tagline,
  logoUrl,
  email,
  phone,
  whatsappNumber,
  businessHours,
  locationText,
  socialLinks,
  copyrightText,
  mailchimpConfigured,
}: PublicFooterProps) {
  const [name, setName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();

    if (!mailchimpConfigured) {
      setSubmitted(true);
      return;
    }

    setSubscribing(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: emailInput }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to subscribe");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <footer>
      {/* Newsletter + social band */}
      <div className="bg-brand-500 px-4 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
          <div className="flex items-center gap-5">
            {socialLinks.map(({ platform, url }) => {
              const Icon = SOCIAL_ICONS[platform];
              if (!Icon) return null;
              return (
                <a key={platform} href={url} target="_blank" rel="noopener noreferrer" aria-label={platform} className="hover:text-white/80">
                  <Icon className="h-6 w-6" />
                </a>
              );
            })}
            {email && (
              <a href={`mailto:${email}`} aria-label="Email" className="hover:text-white/80">
                <Mail className="h-6 w-6" />
              </a>
            )}
            {whatsappNumber && (
              <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="hover:text-white/80">
                <Phone className="h-6 w-6" />
              </a>
            )}
          </div>

          {/* Newsletter signup */}
          {submitted ? (
            <p className="text-center text-sm font-medium text-white/90">
              Thank you for subscribing! You&apos;ll hear from us soon.
            </p>
          ) : (
            <div className="w-full max-w-lg">
              <p className="mb-3 text-center text-sm font-medium text-white/90">
                Sign up for practical tips, new course announcements, and
                exclusive offers.
              </p>
              <form
                onSubmit={handleSubscribe}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <Input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="border-white/30 bg-white/10 text-white placeholder:text-white/60 focus-visible:ring-white"
                />
                <Input
                  type="email"
                  placeholder="Your email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  className="border-white/30 bg-white/10 text-white placeholder:text-white/60 focus-visible:ring-white"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="flex-shrink-0"
                  disabled={subscribing}
                >
                  {subscribing ? "Subscribing..." : "Subscribe"}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Main footer */}
      <div className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Brand */}
            <div>
              <Link href="/" className="flex items-center">
                <Image
                  src={logoUrl || "/logo.png"}
                  alt="Life-Therapy"
                  width={180}
                  height={45}
                  className="h-9 w-auto"
                />
              </Link>
              {tagline && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {tagline}
                </p>
              )}
            </div>

            {/* Quick links */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider">Quick Links</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/about" className="hover:text-foreground">
                    About Roxanne
                  </Link>
                </li>
                <li>
                  <Link href="/courses" className="hover:text-foreground">
                    Online Courses
                  </Link>
                </li>
                <li>
                  <Link href="/sessions" className="hover:text-foreground">
                    1:1 Sessions
                  </Link>
                </li>
                <li>
                  <Link href="/packages" className="hover:text-foreground">
                    Bundles & Packages
                  </Link>
                </li>
                <li>
                  <Link href="/book" className="hover:text-foreground">
                    Book a Session
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider">Contact</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {phone && (
                  <li>
                    <a href={`tel:${phone.replaceAll(" ", "")}`} className="hover:text-foreground">{phone}</a>
                  </li>
                )}
                {email && (
                  <li>
                    <a href={`mailto:${email}`} className="hover:text-foreground">{email}</a>
                  </li>
                )}
                {businessHours?.split("\n").map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {locationText && <li>{locationText}</li>}
              </ul>
            </div>
          </div>

          {copyrightText && (
            <div className="mt-8 border-t pt-8 text-center text-xs text-muted-foreground">
              {copyrightText}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
