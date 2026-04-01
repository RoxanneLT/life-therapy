"use client";

import { useState, useEffect, useTransition, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReschedulePicker } from "@/components/booking/reschedule-picker";
import { SESSION_TYPES } from "@/lib/booking-config";
import {
  generateRecurringDatesUntil,
  RECURRING_PATTERNS,
  type RecurringPattern,
} from "@/lib/recurring-dates";
import {
  adminCreateBookingAction,
  adminCreateRecurringBookingsAction,
  adminCreateHistoricalBookingAction,
  checkBillingCycleStatusAction,
  getClientsForBookingAction,
  getClientCreditBalance,
  getClientPartnersAction,
} from "./actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle,
  CalendarPlus,
  Clock,
  Loader2,
  MapPin,
  Receipt,
  RefreshCw,
  Repeat,
  Search,
  Check,
  Video,
} from "lucide-react";
import type { SessionMode, SessionType } from "@/lib/generated/prisma/client";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  clientStatus: string;
  billingType: string | null;
}

interface PartnerOption {
  id: string;
  firstName: string;
  lastName: string;
}

type BookingMode = "single" | "recurring";
type SessionLocation = "online" | "in_person";
type BillingResolution = "auto" | "defer" | "invoice_now" | "amend_request";
type BillingCycleStatus =
  | { status: "open" }
  | { status: "no_billing" }
  | { status: "pending"; billingMonth: string; existingRequestId: string }
  | { status: "closed"; billingMonth: string };

/** Default "repeat until" date: 3 months from today */
function defaultEndDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface CreateBookingDialogProps {
  /** Controlled open state (used by CalendarShell) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pre-fill date/time from slot click (yyyy-MM-dd / HH:mm) */
  prefilledDate?: string;
  prefilledTime?: string;
}

export function CreateBookingDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  prefilledDate,
  prefilledTime,
}: Readonly<CreateBookingDialogProps> = {}) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen! : internalOpen;
  const [isPending, startTransition] = useTransition();

  // Step tracking: 1 = select client + type, 2 = pick date/time
  const [step, setStep] = useState<1 | 2>(1);

  // Client search
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session type
  const [sessionType, setSessionType] = useState<SessionType>("individual");

  // Booking mode
  const [bookingMode, setBookingMode] = useState<BookingMode>("single");

  // Session location
  const [sessionLocation, setSessionLocation] = useState<SessionLocation>("online");

  // Credits
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [useCredit, setUseCredit] = useState(true);

  // Admin notes
  const [adminNotes, setAdminNotes] = useState("");

  // Couples partner
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [selectedPartnerName, setSelectedPartnerName] = useState("");
  const [customPartnerName, setCustomPartnerName] = useState("");

  // Recurring options
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>("weekly");
  const [recurringEndDate, setRecurringEndDate] = useState(defaultEndDate);

  // Recurring: selected first date + time from picker (captured when user confirms in picker)
  const [recurringDate, setRecurringDate] = useState("");
  const [recurringStartTime, setRecurringStartTime] = useState("");
  const [recurringEndTime, setRecurringEndTime] = useState("");

  // Recurring result
  const [recurringResult, setRecurringResult] = useState<{
    created: number;
    skipped: { date: string; reason: string }[];
    creditsUsed: number;
    seriesId: string;
  } | null>(null);

  // Error
  const [error, setError] = useState("");

  // Historical booking billing state
  const [pendingDate, setPendingDate] = useState("");
  const [pendingStartTime, setPendingStartTime] = useState("");
  const [pendingEndTime, setPendingEndTime] = useState("");
  const [billingCycleInfo, setBillingCycleInfo] = useState<BillingCycleStatus | null>(null);
  const [showBillingPrompt, setShowBillingPrompt] = useState(false);

  // Config for selected session type
  const config = SESSION_TYPES.find((s) => s.type === sessionType)!;

  // Generate recurring dates preview
  const recurringDates = useMemo(() => {
    if (!recurringDate || !recurringEndDate) return [];
    return generateRecurringDatesUntil(recurringDate, recurringPattern, recurringEndDate);
  }, [recurringDate, recurringPattern, recurringEndDate]);

  // Search clients with debounce
  const searchClients = useCallback(async (q: string) => {
    setLoadingClients(true);
    try {
      const results = await getClientsForBookingAction(q);
      setClients(results);
    } catch {
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open, searchClients]);

  // Load initial clients when dialog opens
  useEffect(() => {
    if (open) {
      searchClients("");
    }
  }, [open, searchClients]);

  // Fetch credit balance when client selected
  useEffect(() => {
    if (!selectedClient) {
      setCreditBalance(null);
      return;
    }
    // Postpaid clients don't use credits — auto-uncheck
    if (selectedClient.billingType === "postpaid") {
      setUseCredit(false);
      setCreditBalance(null);
      return;
    }
    getClientCreditBalance(selectedClient.id)
      .then((balance) => {
        setCreditBalance(balance);
        // Auto-uncheck if no credits available
        if (balance < 1) setUseCredit(false);
      })
      .catch(() => setCreditBalance(null));
  }, [selectedClient]);

  // Fetch partners when client selected and session type is couples
  useEffect(() => {
    if (!selectedClient || sessionType !== "couples") {
      setPartners([]);
      setSelectedPartnerName("");
      setCustomPartnerName("");
      return;
    }
    getClientPartnersAction(selectedClient.id)
      .then((result) => {
        setPartners(result);
        if (result.length === 1) {
          setSelectedPartnerName(`${result[0].firstName} ${result[0].lastName}`);
        }
      })
      .catch(() => setPartners([]));
  }, [selectedClient, sessionType]);

  function handleSetOpen(value: boolean) {
    if (!isControlled) setInternalOpen(value);
    controlledOnOpenChange?.(value);
  }

  function resetForm() {
    setStep(1);
    setSearch("");
    setSelectedClient(null);
    setSessionType("individual");
    setBookingMode("single");
    setSessionLocation("online");
    setCreditBalance(null);
    setUseCredit(true);
    setAdminNotes("");
    setPartners([]);
    setSelectedPartnerName("");
    setCustomPartnerName("");
    setRecurringPattern("weekly");
    setRecurringEndDate(defaultEndDate());
    setRecurringDate("");
    setRecurringStartTime("");
    setRecurringEndTime("");
    setRecurringResult(null);
    setError("");
    setPendingDate("");
    setPendingStartTime("");
    setPendingEndTime("");
    setBillingCycleInfo(null);
    setShowBillingPrompt(false);
  }

  function handleOpenChange(isOpen: boolean) {
    handleSetOpen(isOpen);
    if (!isOpen) resetForm();
  }

  // Effective partner name for couples bookings
  const effectivePartnerName =
    sessionType === "couples"
      ? (selectedPartnerName === "__custom__" ? customPartnerName.trim() : selectedPartnerName) || undefined
      : undefined;

  function handleNext() {
    if (!selectedClient) return;
    setError("");
    setStep(2);
  }

  // Single booking confirm — handles both future (normal) and past (historical)
  function handleSingleConfirm(date: string, startTime: string, endTime: string) {
    if (!selectedClient) return;
    setError("");

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const isPast = date < todayStr;

    if (!isPast) {
      // Normal future booking
      startTransition(async () => {
        try {
          const result = await adminCreateBookingAction({
            studentId: selectedClient.id,
            sessionType,
            sessionMode: sessionLocation as SessionMode,
            date,
            startTime,
            endTime,
            useCredit: useCredit && !config.isFree,
            adminNotes: adminNotes.trim() || undefined,
            couplesPartnerName: effectivePartnerName,
          });
          handleSetOpen(false);
          resetForm();
          if (result?.bookingId) router.push(`/admin/bookings/${result.bookingId}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create booking");
        }
      });
      return;
    }

    // Past booking — capture and check billing cycle for postpaid clients
    setPendingDate(date);
    setPendingStartTime(startTime);
    setPendingEndTime(endTime);

    if (selectedClient.billingType === "postpaid" && !config.isFree) {
      startTransition(async () => {
        try {
          const cycleStatus = await checkBillingCycleStatusAction(selectedClient.id, date);
          if (cycleStatus.status === "pending" || cycleStatus.status === "closed") {
            setBillingCycleInfo(cycleStatus);
            setShowBillingPrompt(true);
          } else {
            await submitHistoricalBooking(date, startTime, endTime, "auto");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to check billing cycle");
        }
      });
    } else {
      startTransition(async () => {
        await submitHistoricalBooking(date, startTime, endTime, "auto");
      });
    }
  }

  async function submitHistoricalBooking(
    date: string,
    startTime: string,
    endTime: string,
    resolution: BillingResolution,
  ) {
    if (!selectedClient) return;
    try {
      const existingRequestId =
        resolution === "amend_request" && billingCycleInfo?.status === "pending"
          ? (billingCycleInfo as { status: "pending"; existingRequestId: string }).existingRequestId
          : undefined;
      const result = await adminCreateHistoricalBookingAction({
        studentId: selectedClient.id,
        sessionType,
        sessionMode: sessionLocation as SessionMode,
        date,
        startTime,
        endTime,
        adminNotes: adminNotes.trim() || undefined,
        couplesPartnerName: effectivePartnerName,
        billingResolution: resolution,
        existingRequestId,
      });
      setShowBillingPrompt(false);
      handleSetOpen(false);
      resetForm();
      if (result?.bookingId) router.push(`/admin/bookings/${result.bookingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create booking");
    }
  }

  function handleHistoricalBookingCreate(resolution: BillingResolution) {
    setError("");
    startTransition(async () => {
      await submitHistoricalBooking(pendingDate, pendingStartTime, pendingEndTime, resolution);
    });
  }

  // Recurring: capture first date/time from picker (reject past dates)
  function handleRecurringSlotSelect(date: string, startTime: string, endTime: string) {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (date < todayStr) {
      setError("Recurring series cannot start in the past. Use single session for historical entries.");
      return;
    }
    setRecurringDate(date);
    setRecurringStartTime(startTime);
    setRecurringEndTime(endTime);
  }

  // Recurring: create all sessions
  function handleRecurringSubmit() {
    if (!selectedClient || !recurringDate || !recurringStartTime) return;
    setError("");

    startTransition(async () => {
      try {
        const result = await adminCreateRecurringBookingsAction({
          studentId: selectedClient.id,
          sessionType,
          sessionMode: sessionLocation as SessionMode,
          startDate: recurringDate,
          startTime: recurringStartTime,
          endTime: recurringEndTime,
          pattern: recurringPattern,
          endDate: recurringEndDate,
          useCredits: useCredit && !config.isFree,
          adminNotes: adminNotes.trim() || undefined,
          couplesPartnerName: effectivePartnerName,
        });
        setRecurringResult(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create recurring bookings"
        );
      }
    });
  }

  const dayOfWeek = recurringDate
    ? format(new Date(recurringDate + "T12:00:00"), "EEEE")
    : "";

  const creditsForSeries = recurringDates.length;
  const creditsAvailable = creditBalance ?? 0;
  const creditsWillUse = useCredit && !config.isFree
    ? Math.min(creditsForSeries, creditsAvailable)
    : 0;
  const sessionsWithoutCredit = useCredit && !config.isFree
    ? Math.max(0, creditsForSeries - creditsAvailable)
    : creditsForSeries;

  // Computed values for prefilled past session
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isPrefilledPast = !!prefilledDate && prefilledDate < todayStr;
  const prefilledEndTime = prefilledTime && config
    ? addMinutes(prefilledTime, config.durationMinutes)
    : undefined;

  return (
    <>
    {/* Billing resolution AlertDialog — shown over the booking dialog */}
    {billingCycleInfo && (billingCycleInfo.status === "pending" || billingCycleInfo.status === "closed") && (
      <AlertDialog open={showBillingPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-500" />
              {billingCycleInfo.status === "pending"
                ? `Unpaid Payment Request — ${billingCycleInfo.billingMonth}`
                : `Billing Cycle Closed — ${billingCycleInfo.billingMonth}`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {billingCycleInfo.status === "pending" ? (
                  <>
                    <p>
                      A payment request for <strong>{billingCycleInfo.billingMonth}</strong> has
                      been sent to {selectedClient?.firstName} and is still unpaid.
                    </p>
                    <p>Choose how to handle billing for this session:</p>
                  </>
                ) : (
                  <>
                    <p>
                      The billing cycle for <strong>{billingCycleInfo.billingMonth}</strong> has
                      already been paid or invoiced. This session cannot be added to that cycle.
                    </p>
                    <p>Choose how to handle billing:</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel onClick={() => setShowBillingPrompt(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleHistoricalBookingCreate("defer")}
              disabled={isPending}
            >
              <Clock className="mr-2 h-4 w-4" />
              Add to Next Cycle
            </Button>
            <Button
              variant="outline"
              onClick={() => handleHistoricalBookingCreate("invoice_now")}
              disabled={isPending}
            >
              <Receipt className="mr-2 h-4 w-4" />
              Invoice Separately
            </Button>
            {billingCycleInfo.status === "pending" && (
              <Button
                onClick={() => handleHistoricalBookingCreate("amend_request")}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Add to Existing Request & Resend
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )}

    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <CalendarPlus className="h-4 w-4" />
            New Booking
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {recurringResult
              ? "Recurring Series Created"
              : step === 1
                ? "New Booking — Select Client"
                : bookingMode === "single"
                  ? "New Booking — Choose Date & Time"
                  : recurringDate
                    ? "Recurring Series — Review & Confirm"
                    : "Recurring Series — Choose First Session"}
          </DialogTitle>
        </DialogHeader>

        {/* Recurring result screen */}
        {recurringResult && (
          <div className="space-y-4">
            <div className="rounded-md border bg-green-50 p-4">
              <p className="font-medium text-green-800">
                Created {recurringResult.created} session{recurringResult.created !== 1 ? "s" : ""}
              </p>
              {recurringResult.creditsUsed > 0 && (
                <p className="mt-1 text-sm text-green-700">
                  {recurringResult.creditsUsed} credit{recurringResult.creditsUsed !== 1 ? "s" : ""} deducted
                </p>
              )}
            </div>
            {recurringResult.skipped.length > 0 && (
              <div className="rounded-md border bg-yellow-50 p-4">
                <p className="text-sm font-medium text-yellow-800">
                  {recurringResult.skipped.length} date{recurringResult.skipped.length !== 1 ? "s" : ""} skipped:
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-yellow-700">
                  {recurringResult.skipped.map((s) => (
                    <li key={s.date}>
                      {format(new Date(s.date + "T12:00:00"), "d MMM yyyy")} — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  handleSetOpen(false);
                  resetForm();
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  handleSetOpen(false);
                  resetForm();
                  router.push(`/admin/bookings?series=${recurringResult.seriesId}`);
                }}
              >
                View Series
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Client + Type + Mode selection */}
        {!recurringResult && step === 1 && (
          <div className="space-y-5">
            {/* Client search */}
            <div className="space-y-2">
              <Label>Client</Label>
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedClient.firstName} {selectedClient.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedClient.email}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClient(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {loadingClients ? (
                      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    ) : clients.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No clients found
                      </p>
                    ) : (
                      clients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedClient(c)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {c.firstName} {c.lastName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.email}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {c.clientStatus}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Session type */}
            <div className="space-y-2">
              <Label>Session Type</Label>
              <Select
                value={sessionType}
                onValueChange={(v) => setSessionType(v as SessionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((st) => (
                    <SelectItem key={st.type} value={st.type}>
                      {st.label} ({st.durationMinutes} min)
                      {st.isFree ? " — Free" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Couples partner selection */}
            {sessionType === "couples" && selectedClient && (
              <div className="space-y-2">
                <Label>Partner</Label>
                {partners.length > 0 ? (
                  <>
                    <Select
                      value={selectedPartnerName}
                      onValueChange={(v) => {
                        setSelectedPartnerName(v);
                        if (v !== "__custom__") setCustomPartnerName("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select partner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {partners.map((p) => {
                          const name = `${p.firstName} ${p.lastName}`;
                          return (
                            <SelectItem key={p.id} value={name}>
                              {name}
                            </SelectItem>
                          );
                        })}
                        <SelectItem value="__custom__">Other (type name)</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedPartnerName === "__custom__" && (
                      <Input
                        value={customPartnerName}
                        onChange={(e) => setCustomPartnerName(e.target.value)}
                        placeholder="Partner's full name"
                      />
                    )}
                  </>
                ) : (
                  <Input
                    value={customPartnerName}
                    onChange={(e) => {
                      setCustomPartnerName(e.target.value);
                      setSelectedPartnerName("__custom__");
                    }}
                    placeholder="Partner's full name"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {partners.length === 0
                    ? "No linked partners. Type the partner's name manually."
                    : "Select a linked partner or choose 'Other' to type a name."}
                </p>
              </div>
            )}

            {/* Booking mode toggle */}
            {!isPrefilledPast && (
              <div className="space-y-2">
                <Label>Booking Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={bookingMode === "single" ? "default" : "outline-solid"}
                    size="sm"
                    onClick={() => setBookingMode("single")}
                    className="flex-1"
                  >
                    <CalendarPlus className="mr-1.5 h-4 w-4" />
                    Single Session
                  </Button>
                  <Button
                    type="button"
                    variant={bookingMode === "recurring" ? "default" : "outline-solid"}
                    size="sm"
                    onClick={() => setBookingMode("recurring")}
                    className="flex-1"
                  >
                    <Repeat className="mr-1.5 h-4 w-4" />
                    Recurring Series
                  </Button>
                </div>
              </div>
            )}

            {/* Session location */}
            <div className="space-y-2">
              <Label>Session Location</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={sessionLocation === "online" ? "default" : "outline-solid"}
                  size="sm"
                  onClick={() => setSessionLocation("online")}
                  className="flex-1"
                >
                  <Video className="mr-1.5 h-4 w-4" />
                  Online (Teams)
                </Button>
                <Button
                  type="button"
                  variant={sessionLocation === "in_person" ? "default" : "outline-solid"}
                  size="sm"
                  onClick={() => setSessionLocation("in_person")}
                  className="flex-1"
                >
                  <MapPin className="mr-1.5 h-4 w-4" />
                  In Person
                </Button>
              </div>
              {sessionLocation === "in_person" && (
                <p className="text-xs text-muted-foreground">
                  Brown House Unit 2, 13 Station Street, Paarl
                </p>
              )}
            </div>

            {/* Recurring options (visible in step 1) */}
            {bookingMode === "recurring" && (
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Frequency</Label>
                    <Select
                      value={recurringPattern}
                      onValueChange={(v) => setRecurringPattern(v as RecurringPattern)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRING_PATTERNS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Repeat until</Label>
                    <input
                      type="date"
                      value={recurringEndDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setRecurringEndDate(e.target.value)}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Credit / billing option */}
            {selectedClient && !config.isFree && (
              <div className="space-y-2">
                {selectedClient.billingType === "postpaid" ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    Post-paid client — session will be added to monthly invoice
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useCredit"
                        checked={useCredit}
                        onChange={(e) => setUseCredit(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                        disabled={creditBalance !== null && creditBalance < 1}
                      />
                      <Label htmlFor="useCredit" className="cursor-pointer">
                        Deduct session credit{bookingMode === "recurring" ? "s" : ""}
                      </Label>
                    </div>
                    {creditBalance !== null && creditBalance < 1 && (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        No credits available — session will be post-paid
                      </p>
                    )}
                    {creditBalance !== null && creditBalance >= 1 && (
                      <p className="text-xs text-muted-foreground">
                        Client balance: {creditBalance} credit{creditBalance !== 1 ? "s" : ""}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Admin notes */}
            <div className="space-y-2">
              <Label htmlFor="bookingNotes">Admin Notes (optional)</Label>
              <textarea
                id="bookingNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                placeholder="Internal notes..."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button
                onClick={handleNext}
                disabled={!selectedClient}
              >
                {bookingMode === "single"
                  ? "Next — Pick Date & Time"
                  : "Next — Pick First Session"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Single booking */}
        {!recurringResult && step === 2 && bookingMode === "single" && (
          <div className="space-y-4">
            <SummaryBar
              client={selectedClient}
              configLabel={config.label}
              useCredit={useCredit}
              isFree={config.isFree}
              onBack={() => setStep(1)}
            />

            {isPrefilledPast ? (
              /* Past session — fixed date/time view */
              <>
                <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="space-y-1">
                    <p className="font-medium">Recording a past session</p>
                    <p>
                      This session date is in the past. The booking will be recorded as{" "}
                      <strong>Completed</strong> immediately. No confirmation email will be
                      sent and no calendar event will be created.
                    </p>
                    {selectedClient?.billingType === "postpaid" && (
                      <p>
                        Billing will be handled based on whether the{" "}
                        <strong>{format(parseISO(prefilledDate!), "MMMM")}</strong> billing
                        cycle has already been processed for this client.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Date: </span>
                    <span className="font-medium">
                      {format(parseISO(prefilledDate!), "EEEE, d MMMM yyyy")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time: </span>
                    <span className="font-medium">
                      {prefilledTime} – {prefilledEndTime}
                    </span>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end">
                  <Button
                    onClick={() => handleSingleConfirm(prefilledDate!, prefilledTime!, prefilledEndTime!)}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording...</>
                    ) : (
                      "Record Past Session"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Future session — normal picker */
              <>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <ReschedulePicker
                  sessionType={sessionType}
                  currentDate=""
                  currentTime=""
                  onConfirm={handleSingleConfirm}
                  isPending={isPending}
                  mode="new"
                  isAdmin
                  defaultDate={prefilledDate}
                  defaultTime={prefilledTime}
                />
              </>
            )}
          </div>
        )}

        {/* Step 2: Recurring — date/time picker (before selection) */}
        {!recurringResult && step === 2 && bookingMode === "recurring" && !recurringDate && (
          <div className="space-y-4">
            <SummaryBar
              client={selectedClient}
              configLabel={config.label}
              useCredit={useCredit}
              isFree={config.isFree}
              onBack={() => setStep(1)}
              extra={
                <span className="text-xs text-muted-foreground">
                  <Repeat className="mr-0.5 inline h-3 w-3" />
                  {RECURRING_PATTERNS.find((p) => p.value === recurringPattern)?.label} until {recurringEndDate ? format(new Date(recurringEndDate + "T12:00:00"), "d MMM yyyy") : "—"}
                </span>
              }
            />
            <p className="text-sm text-muted-foreground">
              Select the date and time for the <strong>first session</strong>. All future sessions will use the same day of week and time.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <ReschedulePicker
              sessionType={sessionType}
              currentDate=""
              currentTime=""
              onConfirm={handleRecurringSlotSelect}
              isPending={false}
              mode="new"
              isAdmin
            />
          </div>
        )}

        {/* Step 2: Recurring — confirmation popup with all dates */}
        {!recurringResult && step === 2 && bookingMode === "recurring" && recurringDate && (
          <div className="space-y-4">
            <SummaryBar
              client={selectedClient}
              configLabel={config.label}
              useCredit={useCredit}
              isFree={config.isFree}
              onBack={() => {
                setRecurringDate("");
                setRecurringStartTime("");
                setRecurringEndTime("");
              }}
              backLabel="Change date"
            />

            {/* Confirmation banner */}
            <div className="rounded-md border-2 border-brand-200 bg-brand-50/50 p-4 space-y-1 dark:border-brand-800 dark:bg-brand-950/20">
              <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
                Confirm {recurringDates.length} bookings
              </p>
              <p className="text-sm text-brand-700 dark:text-brand-300">
                Every {RECURRING_PATTERNS.find((p) => p.value === recurringPattern)?.label.toLowerCase()} on {dayOfWeek}s at {recurringStartTime} – {recurringEndTime}
              </p>
              <p className="text-xs text-brand-600 dark:text-brand-400">
                {format(new Date(recurringDates[0] + "T12:00:00"), "d MMM yyyy")} → {format(new Date(recurringDates[recurringDates.length - 1] + "T12:00:00"), "d MMM yyyy")} · public holidays excluded
              </p>
              {!config.isFree && useCredit && creditBalance !== null && (
                <p className="text-xs text-brand-600 dark:text-brand-400">
                  Credits: {creditsAvailable} available, {creditsWillUse} will be used
                  {sessionsWithoutCredit > 0 && (
                    <span className="text-yellow-600">
                      {" "}· {sessionsWithoutCredit} session{sessionsWithoutCredit !== 1 ? "s" : ""} without credit
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Full date list — always visible */}
            <div className="rounded-md border">
              <div className="border-b bg-muted/50 px-3 py-2">
                <p className="text-sm font-medium">
                  All scheduled dates ({recurringDates.length})
                </p>
              </div>
              <div className="max-h-56 overflow-y-auto px-1 py-1">
                {recurringDates.map((d, i) => (
                  <div
                    key={d}
                    className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm odd:bg-muted/30"
                  >
                    <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
                      {i + 1}.
                    </span>
                    <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    <span>
                      {format(new Date(d + "T12:00:00"), "EEE, d MMM yyyy")}
                    </span>
                    <span className="text-muted-foreground">
                      {recurringStartTime} – {recurringEndTime}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRecurringDate("");
                  setRecurringStartTime("");
                  setRecurringEndTime("");
                }}
                disabled={isPending}
              >
                Change Date
              </Button>
              <Button onClick={handleRecurringSubmit} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating {recurringDates.length} sessions...
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5 h-4 w-4" />
                    Confirm & Create {recurringDates.length} Sessions
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

// Shared summary bar component
function SummaryBar({
  client,
  configLabel,
  useCredit,
  isFree,
  onBack,
  backLabel = "Back",
  extra,
}: {
  client: ClientOption | null;
  configLabel: string;
  useCredit: boolean;
  isFree: boolean;
  onBack: () => void;
  backLabel?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-sm">
        <span className="font-medium">
          {client?.firstName} {client?.lastName}
        </span>
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="text-muted-foreground">{configLabel}</span>
        {useCredit && !isFree && (
          <>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-xs text-green-700">
              <Check className="mr-0.5 inline h-3 w-3" />
              Credit
            </span>
          </>
        )}
        {extra && (
          <>
            <span className="mx-2 text-muted-foreground">·</span>
            {extra}
          </>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onBack}>
        {backLabel}
      </Button>
    </div>
  );
}
