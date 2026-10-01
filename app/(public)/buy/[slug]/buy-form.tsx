"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck } from "lucide-react";

export function BuyForm({
  slug,
  free,
  prefill,
}: Readonly<{
  slug: string;
  free: boolean;
  prefill: { email: string; firstName: string; lastName: string };
}>) {
  const [email, setEmail] = useState(prefill.email);
  const [firstName, setFirstName] = useState(prefill.firstName);
  const [lastName, setLastName] = useState(prefill.lastName);
  const [pending, setPending] = useState(false);
  const [resendMode, setResendMode] = useState(false);
  const [resent, setResent] = useState(false);

  async function post(payload: Record<string, unknown>) {
    const res = await fetch("/api/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, email, ...payload }),
    });
    return res.json();
  }

  async function buy(e: React.SyntheticEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const data = await post({ firstName, lastName });
      if (data.url) {
        globalThis.location.href = data.url; // Paystack, or the thank-you page for a free product
        return;
      }
      toast.error(data.error || "Something went wrong. Please try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  async function resend(e: React.SyntheticEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const data = await post({ resend: true });
      if (data.resent) setResent(true);
      else toast.error(data.error || "Something went wrong. Please try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  const emailField = (
    <div className="space-y-1.5">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      {!resendMode && <p className="text-xs text-muted-foreground">Your download link is sent here.</p>}
    </div>
  );

  if (resendMode) {
    // The same words whatever is true of the address — see lib/guest-purchase.ts.
    return resent ? (
      <div className="rounded-md bg-muted p-4 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-brand-600" />
        <p className="mt-2 font-medium">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">
          If {email} has bought this, the download link is on its way.
        </p>
      </div>
    ) : (
      <form onSubmit={resend} className="space-y-4">
        <p className="text-sm text-muted-foreground">Enter the email you bought it with and we&rsquo;ll resend your link.</p>
        {emailField}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Resend my download link
        </Button>
        <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => setResendMode(false)}>
          Back
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={buy} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
        </div>
      </div>
      {emailField}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {free ? "Get it now" : "Pay securely"}
      </Button>
      <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => setResendMode(true)}>
        Already bought this? Resend my download link
      </button>
    </form>
  );
}
