"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Building2,
  Receipt,
  DollarSign,
  CalendarClock,
  Landmark,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateFinanceSettings } from "@/app/(admin)/admin/(dashboard)/settings/finance/actions";
import type { SiteSetting } from "@/lib/generated/prisma/client";

// ─── Sections ─────────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: Section[] = [
  { id: "business", label: "Business Details", icon: Building2 },
  { id: "vat", label: "VAT Configuration", icon: Receipt },
  { id: "pricing", label: "Session Rates", icon: DollarSign },
  { id: "billing", label: "Billing Schedule", icon: CalendarClock },
  { id: "banking", label: "Banking Details", icon: Landmark },
  { id: "invoice", label: "Invoice Template", icon: FileText },
];

// ─── Day options ──────────────────────────────────────────────

const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

// ─── Component ────────────────────────────────────────────────

interface NextDates {
  billing: string;
  due: string;
  reminder: string;
  overdue: string;
}

interface Props {
  initialSettings: SiteSetting;
  nextDates?: NextDates;
}

export function FinanceSettingsForm({ initialSettings, nextDates }: Props) {
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("business");
  const [isDirty, setIsDirty] = useState(false);
  const savedRef = useRef(false);

  // Track unsaved changes via beforeunload
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty && !savedRef.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const markDirty = useCallback(() => {
    if (!isDirty) setIsDirty(true);
  }, [isDirty]);

  // Business details
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(
    initialSettings.businessRegistrationNumber || "",
  );
  const [businessAddress, setBusinessAddress] = useState(
    initialSettings.businessAddress || "",
  );
  const [invoicePrefix, setInvoicePrefix] = useState(
    initialSettings.invoicePrefix || "LT",
  );

  // VAT
  const [vatRegistered, setVatRegistered] = useState(
    initialSettings.vatRegistered,
  );
  const [vatNumber, setVatNumber] = useState(
    initialSettings.vatNumber || "",
  );
  const [vatPercent, setVatPercent] = useState(
    initialSettings.vatPercent?.toString() || "15",
  );

  // Session pricing
  const [sessionPriceIndividualZar, setSessionPriceIndividualZar] = useState(
    initialSettings.sessionPriceIndividualZar?.toString() || "",
  );
  const [sessionPriceIndividualUsd, setSessionPriceIndividualUsd] = useState(
    initialSettings.sessionPriceIndividualUsd?.toString() || "",
  );
  const [sessionPriceIndividualEur, setSessionPriceIndividualEur] = useState(
    initialSettings.sessionPriceIndividualEur?.toString() || "",
  );
  const [sessionPriceIndividualGbp, setSessionPriceIndividualGbp] = useState(
    initialSettings.sessionPriceIndividualGbp?.toString() || "",
  );
  const [sessionPriceCouplesZar, setSessionPriceCouplesZar] = useState(
    initialSettings.sessionPriceCouplesZar?.toString() || "",
  );
  const [sessionPriceCouplesUsd, setSessionPriceCouplesUsd] = useState(
    initialSettings.sessionPriceCouplesUsd?.toString() || "",
  );
  const [sessionPriceCouplesEur, setSessionPriceCouplesEur] = useState(
    initialSettings.sessionPriceCouplesEur?.toString() || "",
  );
  const [sessionPriceCouplesGbp, setSessionPriceCouplesGbp] = useState(
    initialSettings.sessionPriceCouplesGbp?.toString() || "",
  );

  // Billing schedule
  const [postpaidBillingDay, setPostpaidBillingDay] = useState(
    initialSettings.postpaidBillingDay?.toString() || "20",
  );
  const [postpaidDueDay, setPostpaidDueDay] = useState(
    initialSettings.postpaidDueDay?.toString() || "28",
  );

  // Banking
  const [bankName, setBankName] = useState(
    initialSettings.bankName || "",
  );
  const [bankAccountHolder, setBankAccountHolder] = useState(
    initialSettings.bankAccountHolder || "",
  );
  const [bankAccountNumber, setBankAccountNumber] = useState(
    initialSettings.bankAccountNumber || "",
  );
  const [bankBranchCode, setBankBranchCode] = useState(
    initialSettings.bankBranchCode || "",
  );

  // ── Helpers ──

  function formatCents(cents: string): string {
    const n = parseInt(cents, 10);
    if (!cents || isNaN(n)) return "—";
    return (n / 100).toFixed(2);
  }

  // ── Submit ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();

      // Business
      formData.set("businessRegistrationNumber", businessRegistrationNumber);
      formData.set("businessAddress", businessAddress);
      formData.set("invoicePrefix", invoicePrefix);

      // VAT
      formData.set("vatRegistered", vatRegistered ? "true" : "false");
      formData.set("vatNumber", vatNumber);
      formData.set("vatPercent", vatPercent);

      // Pricing
      formData.set("sessionPriceIndividualZar", sessionPriceIndividualZar);
      formData.set("sessionPriceIndividualUsd", sessionPriceIndividualUsd);
      formData.set("sessionPriceIndividualEur", sessionPriceIndividualEur);
      formData.set("sessionPriceIndividualGbp", sessionPriceIndividualGbp);
      formData.set("sessionPriceCouplesZar", sessionPriceCouplesZar);
      formData.set("sessionPriceCouplesUsd", sessionPriceCouplesUsd);
      formData.set("sessionPriceCouplesEur", sessionPriceCouplesEur);
      formData.set("sessionPriceCouplesGbp", sessionPriceCouplesGbp);

      // Billing schedule
      formData.set("postpaidBillingDay", postpaidBillingDay);
      formData.set("postpaidDueDay", postpaidDueDay);

      // Banking
      formData.set("bankName", bankName);
      formData.set("bankAccountHolder", bankAccountHolder);
      formData.set("bankAccountNumber", bankAccountNumber);
      formData.set("bankBranchCode", bankBranchCode);

      const result = await updateFinanceSettings(formData);
      if (result.success) {
        toast.success("Finance settings saved");
        savedRef.current = true;
        setIsDirty(false);
      } else {
        toast.error(result.error || "Failed to save finance settings");
      }
    } catch {
      toast.error("Failed to save finance settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChange={markDirty} className="flex h-[calc(100vh-10rem)] gap-6">
      {/* Sidebar */}
      <div className="flex w-52 shrink-0 flex-col">
        <div className="mb-5">
          <h1 className="font-heading text-2xl font-bold">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Business details, VAT, pricing, billing, and banking.
          </p>
        </div>

        <nav className="flex-1 space-y-0.5">
          {SECTIONS.map((section) => {
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
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t pt-4">
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
          {isDirty && (
            <p className="mt-2 text-center text-xs text-amber-600">
              You have unsaved changes
            </p>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="min-w-0 flex-1 overflow-y-auto pr-1">
        {/* ── Business Details ── */}
        {activeSection === "business" && (
          <Card>
            <CardHeader>
              <CardTitle>Business Details</CardTitle>
              <CardDescription>
                Company information shown on invoices and legal documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="businessRegistrationNumber">
                    Registration Number
                  </Label>
                  <Input
                    id="businessRegistrationNumber"
                    value={businessRegistrationNumber}
                    onChange={(e) =>
                      setBusinessRegistrationNumber(e.target.value)
                    }
                    placeholder="2019/570691/07"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                  <Input
                    id="invoicePrefix"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    placeholder="LT"
                    maxLength={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used in invoice numbers, e.g. 20260225-LT-GS-00001
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessAddress">Business Address</Label>
                <Textarea
                  id="businessAddress"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  rows={3}
                  placeholder="Street address, city, postal code"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── VAT Configuration ── */}
        {activeSection === "vat" && (
          <Card>
            <CardHeader>
              <CardTitle>VAT Configuration</CardTitle>
              <CardDescription>
                Value-Added Tax settings for invoicing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">VAT Registered</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, invoices show as &quot;Tax Invoice&quot; and
                    include VAT calculations
                  </p>
                </div>
                <Switch
                  checked={vatRegistered}
                  onCheckedChange={(v) => { setVatRegistered(v); markDirty(); }}
                />
              </div>

              {vatRegistered && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input
                      id="vatNumber"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder="4XXXXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatPercent">VAT Rate (%)</Label>
                    <Input
                      id="vatPercent"
                      type="number"
                      value={vatPercent}
                      onChange={(e) => setVatPercent(e.target.value)}
                      min={0}
                      max={100}
                      step={0.5}
                    />
                  </div>
                </div>
              )}

              {vatRegistered && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Preview
                  </p>
                  <p className="text-sm">
                    Subtotal: R850.00 &rarr; VAT ({vatPercent || "15"}%): R
                    {((850 * (parseFloat(vatPercent) || 15)) / 100).toFixed(2)}{" "}
                    &rarr; Total: R
                    {(
                      850 +
                      (850 * (parseFloat(vatPercent) || 15)) / 100
                    ).toFixed(2)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Session Rates ── */}
        {activeSection === "pricing" && (
          <Card>
            <CardHeader>
              <CardTitle>Session Rates</CardTitle>
              <CardDescription>
                All values in cents (e.g. 85000 = R850.00, 6500 = $65.00)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="mb-3 text-sm font-medium">
                  Individual Session (60 min)
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionPriceIndividualZar">
                      ZAR (cents)
                    </Label>
                    <Input
                      id="sessionPriceIndividualZar"
                      type="number"
                      value={sessionPriceIndividualZar}
                      onChange={(e) =>
                        setSessionPriceIndividualZar(e.target.value)
                      }
                      placeholder="85000"
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      = R{formatCents(sessionPriceIndividualZar)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionPriceIndividualUsd">
                      USD (cents)
                    </Label>
                    <Input
                      id="sessionPriceIndividualUsd"
                      type="number"
                      value={sessionPriceIndividualUsd}
                      onChange={(e) =>
                        setSessionPriceIndividualUsd(e.target.value)
                      }
                      placeholder="6500"
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      = ${formatCents(sessionPriceIndividualUsd)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionPriceIndividualEur">
                      EUR (cents)
                    </Label>
                    <Input
                      id="sessionPriceIndividualEur"
                      type="number"
                      value={sessionPriceIndividualEur}
                      onChange={(e) =>
                        setSessionPriceIndividualEur(e.target.value)
                      }
                      placeholder="5900"
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      = &euro;{formatCents(sessionPriceIndividualEur)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionPriceIndividualGbp">
                      GBP (cents)
                    </Label>
                    <Input
                      id="sessionPriceIndividualGbp"
                      type="number"
                      value={sessionPriceIndividualGbp}
                      onChange={(e) =>
                        setSessionPriceIndividualGbp(e.target.value)
                      }
                      placeholder="4900"
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      = &pound;{formatCents(sessionPriceIndividualGbp)}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-medium">
                  Couples Session (60 min)
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionPriceCouplesZar">ZAR (cents)</Label>
                    <Input
                      id="sessionPriceCouplesZar"
                      type="number"
                      value={sessionPriceCouplesZar}
                      onChange={(e) =>
                        setSessionPriceCouplesZar(e.target.value)
                      }
                      placeholder="120000"
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      = R{formatCents(sessionPriceCouplesZar)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionPriceCouplesUsd">USD (cents)</Label>
                    <Input
                      id="sessionPriceCouplesUsd"
                      type="number"
                      value={sessionPriceCouplesUsd}
                      onChange={(e) =>
                        setSessionPriceCouplesUsd(e.target.value)
                      }
                      placeholder="9500"
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      = ${formatCents(sessionPriceCouplesUsd)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionPriceCouplesEur">EUR (cents)</Label>
                    <Input
                      id="sessionPriceCouplesEur"
                      type="number"
                      value={sessionPriceCouplesEur}
                      onChange={(e) =>
                        setSessionPriceCouplesEur(e.target.value)
                      }
                      placeholder="8500"
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      = &euro;{formatCents(sessionPriceCouplesEur)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionPriceCouplesGbp">GBP (cents)</Label>
                    <Input
                      id="sessionPriceCouplesGbp"
                      type="number"
                      value={sessionPriceCouplesGbp}
                      onChange={(e) =>
                        setSessionPriceCouplesGbp(e.target.value)
                      }
                      placeholder="7500"
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      = &pound;{formatCents(sessionPriceCouplesGbp)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Free consultations are always R0.00 regardless of currency.
                Leave a field blank to use the default price.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Billing Schedule ── */}
        {activeSection === "billing" && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Billing Schedule</CardTitle>
              <CardDescription>
                Controls when postpaid payment requests are generated and when
                they&apos;re due
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Billing Day</Label>
                  <Select
                    value={postpaidBillingDay}
                    onValueChange={(v) => { setPostpaidBillingDay(v); markDirty(); }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d.toString()}>
                          {d}
                          {d === 1
                            ? "st"
                            : d === 2
                              ? "nd"
                              : d === 3
                                ? "rd"
                                : "th"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Day of the month when payment requests are generated
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Due Day</Label>
                  <Select
                    value={postpaidDueDay}
                    onValueChange={(v) => { setPostpaidDueDay(v); markDirty(); }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d.toString()}>
                          {d}
                          {d === 1
                            ? "st"
                            : d === 2
                              ? "nd"
                              : d === 3
                                ? "rd"
                                : "th"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Day of the month when payment is due
                  </p>
                </div>
              </div>

              {parseInt(postpaidDueDay) <= parseInt(postpaidBillingDay) && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Due day must be after billing day. Please adjust.
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-4 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Schedule
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    Payment requests sent on the{" "}
                    <span className="font-medium text-foreground">
                      {postpaidBillingDay}
                      {parseInt(postpaidBillingDay) === 1
                        ? "st"
                        : parseInt(postpaidBillingDay) === 2
                          ? "nd"
                          : parseInt(postpaidBillingDay) === 3
                            ? "rd"
                            : "th"}
                    </span>{" "}
                    of each month
                  </li>
                  <li>
                    Payment due by the{" "}
                    <span className="font-medium text-foreground">
                      {postpaidDueDay}
                      {parseInt(postpaidDueDay) === 1
                        ? "st"
                        : parseInt(postpaidDueDay) === 2
                          ? "nd"
                          : parseInt(postpaidDueDay) === 3
                            ? "rd"
                            : "th"}
                    </span>
                  </li>
                  <li>Friendly reminder sent 2 business days before due date</li>
                  <li>Overdue notice sent 1 business day after due date</li>
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dates falling on weekends or SA public holidays are
                  automatically shifted to the preceding business day.
                </p>
              </div>

              {nextDates && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
                  <p className="mb-1 text-xs font-medium text-blue-700">
                    Next Month&apos;s Effective Dates
                  </p>
                  <ul className="space-y-1 text-blue-900">
                    <li>Billing: <span className="font-medium">{nextDates.billing}</span></li>
                    <li>Reminder: <span className="font-medium">{nextDates.reminder}</span></li>
                    <li>Due: <span className="font-medium">{nextDates.due}</span></li>
                    <li>Overdue notice: <span className="font-medium">{nextDates.overdue}</span></li>
                  </ul>
                  <p className="mt-1.5 text-xs text-blue-600">
                    Based on current settings. Save changes and reload to see updated dates.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Banking Details ── */}
        {activeSection === "banking" && (
          <Card>
            <CardHeader>
              <CardTitle>Banking Details</CardTitle>
              <CardDescription>
                Displayed on invoices for EFT payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="FNB"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountHolder">Account Holder</Label>
                  <Input
                    id="bankAccountHolder"
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder="Life Therapy (Pty) Ltd"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="62XXXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankBranchCode">Branch Code</Label>
                  <Input
                    id="bankBranchCode"
                    value={bankBranchCode}
                    onChange={(e) => setBankBranchCode(e.target.value)}
                    placeholder="250655"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Invoice Template ── */}
        {activeSection === "invoice" && (
          <InvoicePreview
            vatRegistered={vatRegistered}
            vatPercent={vatPercent}
            vatNumber={vatNumber}
            businessRegistrationNumber={businessRegistrationNumber}
            businessAddress={businessAddress}
            invoicePrefix={invoicePrefix}
            bankName={bankName}
            bankAccountHolder={bankAccountHolder}
            bankAccountNumber={bankAccountNumber}
            bankBranchCode={bankBranchCode}
          />
        )}
      </div>
    </form>
  );
}

// ─── Invoice Preview ──────────────────────────────────────────

// Sample data matching what the PDF generator would produce
const SAMPLE_ITEMS = [
  { desc: "Individual Session (60 min)", sub: "Mon 10 Feb 2026 at 10:00", qty: "1.00", price: "R850.00", total: "R850.00" },
  { desc: "Individual Session (60 min)", sub: "Mon 17 Feb 2026 at 10:00", qty: "1.00", price: "R850.00", total: "R850.00" },
  { desc: "Individual Session (60 min)", sub: "Mon 24 Feb 2026 at 10:00", qty: "1.00", price: "R850.00", total: "R850.00" },
];

function InvoicePreview({
  vatRegistered,
  vatPercent,
  vatNumber,
  businessRegistrationNumber,
  businessAddress,
  invoicePrefix,
  bankName,
  bankAccountHolder,
  bankAccountNumber,
  bankBranchCode,
}: {
  vatRegistered: boolean;
  vatPercent: string;
  vatNumber: string;
  businessRegistrationNumber: string;
  businessAddress: string;
  invoicePrefix: string;
  bankName: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankBranchCode: string;
}) {
  const vatRate = parseFloat(vatPercent) || 15;
  const subtotal = 2550; // 3 sessions × R850
  const vatAmount = vatRegistered ? (subtotal * vatRate) / 100 : 0;
  const grandTotal = subtotal + vatAmount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Template</CardTitle>
        <CardDescription>
          Live preview using your current settings. Changes in Business Details, VAT, and Banking will reflect here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* A4-ratio container */}
        <div
          className="mx-auto w-full max-w-[600px] overflow-hidden rounded border bg-white shadow-md"
          style={{ aspectRatio: "210 / 297", fontFamily: "Helvetica, Arial, sans-serif" }}
        >
          <div className="flex h-full flex-col p-[5%]">
            {/* ── HEADER ── */}
            <div className="mb-[3%]">
              <div className="flex items-start justify-between">
                <h2
                  className="text-[clamp(14px,2.5vw,22px)] font-bold"
                  style={{ color: "#8BA889" }}
                >
                  {vatRegistered ? "Tax Invoice" : "Invoice"}
                </h2>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-[clamp(24px,5vw,40px)] w-auto object-contain"
                />
              </div>
              <div className="mt-[2%] border-t" style={{ borderColor: "#dcdcdc" }} />
            </div>

            {/* ── BUSINESS + META ── */}
            <div className="mb-[3%] flex gap-[4%]" style={{ fontSize: "clamp(6px,1.2vw,9px)" }}>
              {/* Business details — left ~55% */}
              <div className="w-[55%]">
                <p className="font-bold" style={{ color: "#212121", fontSize: "clamp(8px,1.5vw,11px)" }}>
                  Life Therapy (Pty) Ltd
                </p>
                {businessRegistrationNumber && (
                  <p style={{ color: "#787878" }}>Reg: {businessRegistrationNumber}</p>
                )}
                {vatRegistered && vatNumber && (
                  <p style={{ color: "#787878" }}>VAT: {vatNumber}</p>
                )}
                {businessAddress && (
                  <p className="whitespace-pre-line" style={{ color: "#787878" }}>
                    {businessAddress}
                  </p>
                )}
              </div>

              {/* Invoice meta — right ~45% */}
              <div className="w-[45%]">
                {[
                  ["Number:", `20260220-${invoicePrefix || "LT"}-GS-00001`],
                  ["Date:", "20 February 2026"],
                  ["Reference:", `GS - ${invoicePrefix || "LT"}`],
                  ["Page:", "1"],
                  ["Due Date:", "28 February 2026"],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-1">
                    <span className="w-[45%] font-bold" style={{ color: "#787878" }}>
                      {label}
                    </span>
                    <span style={{ color: "#212121" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t" style={{ borderColor: "#dcdcdc" }} />

            {/* ── BILL TO ── */}
            <div className="my-[2%]" style={{ fontSize: "clamp(6px,1.2vw,9px)" }}>
              <p className="font-bold" style={{ color: "#787878", fontSize: "clamp(7px,1.3vw,9px)" }}>
                Bill To:
              </p>
              <p className="font-bold" style={{ color: "#212121", fontSize: "clamp(7px,1.4vw,10px)" }}>
                Grace Smith
              </p>
              <p style={{ color: "#787878" }}>123 Main Road, Cape Town, 8001</p>
            </div>

            <div className="border-t" style={{ borderColor: "#dcdcdc" }} />

            {/* ── LINE ITEMS TABLE ── */}
            <div className="my-[2%] flex-1" style={{ fontSize: "clamp(6px,1.1vw,8.5px)" }}>
              {/* Header */}
              <div
                className="flex py-[1%] font-bold"
                style={{ backgroundColor: "#f5f8f5", color: "#212121" }}
              >
                <span className="w-[50%] pl-[1%]">Description</span>
                <span className="w-[14%] text-center">Qty</span>
                <span className="w-[18%] text-right">Excl. Price</span>
                <span className="w-[18%] pr-[1%] text-right">Total</span>
              </div>
              <div className="border-t" style={{ borderColor: "#dcdcdc" }} />

              {/* Rows */}
              {SAMPLE_ITEMS.map((item, i) => (
                <div key={i}>
                  <div className="flex py-[0.8%]" style={{ color: "#212121" }}>
                    <span className="w-[50%] pl-[1%]">{item.desc}</span>
                    <span className="w-[14%] text-center">{item.qty}</span>
                    <span className="w-[18%] text-right">{item.price}</span>
                    <span className="w-[18%] pr-[1%] text-right">{item.total}</span>
                  </div>
                  {item.sub && (
                    <div
                      className="pb-[0.5%] pl-[2%]"
                      style={{ color: "#787878", fontSize: "clamp(5px,1vw,7.5px)" }}
                    >
                      {item.sub}
                    </div>
                  )}
                  <div className="border-t" style={{ borderColor: "#dcdcdc" }} />
                </div>
              ))}
            </div>

            {/* ── FOOTER: Banking + Totals ── */}
            <div className="border-t" style={{ borderColor: "#dcdcdc" }} />
            <div
              className="mt-[2%] flex gap-[4%]"
              style={{ fontSize: "clamp(6px,1.1vw,8.5px)" }}
            >
              {/* Banking — left ~62% */}
              <div className="w-[62%]">
                <p className="mb-[1%] font-bold" style={{ color: "#212121" }}>
                  Banking Details
                </p>
                {[
                  ["Bank:", bankName],
                  ["Account Holder:", bankAccountHolder],
                  ["Account No:", bankAccountNumber],
                  ["Branch:", bankBranchCode],
                  ["Reg No:", businessRegistrationNumber],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex gap-1">
                    <span className="w-[40%] font-bold" style={{ color: "#787878" }}>
                      {label}
                    </span>
                    <span style={{ color: "#212121" }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Totals — right ~38% */}
              <div className="w-[38%]">
                <div className="flex justify-between" style={{ color: "#787878" }}>
                  <span>Total Exclusive:</span>
                  <span style={{ color: "#212121" }}>R{subtotal.toFixed(2)}</span>
                </div>

                {vatRegistered && (
                  <div className="flex justify-between" style={{ color: "#787878" }}>
                    <span>VAT ({vatRate}%):</span>
                    <span style={{ color: "#212121" }}>R{vatAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="mt-[3%] border-t pt-[3%]" style={{ borderColor: "#dcdcdc" }}>
                  <div
                    className="flex justify-between font-bold"
                    style={{ color: "#212121", fontSize: "clamp(8px,1.5vw,11px)" }}
                  >
                    <span>Total:</span>
                    <span>R{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Sample invoice using current settings. Edit Business Details, VAT, and Banking sections to update.
        </p>
      </CardContent>
    </Card>
  );
}
