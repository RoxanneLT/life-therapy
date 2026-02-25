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
  generateRecurringDates,
  RECURRING_PATTERNS,
  type RecurringPattern,
} from "@/lib/recurring-dates";
import {
  adminCreateBookingAction,
  adminCreateRecurringBookingsAction,
  getClientsForBookingAction,
  getClientCreditBalance,
} from "./actions";
import {
  CalendarPlus,
  Loader2,
  Search,
  Check,
  Repeat,
  ChevronDown,
} from "lucide-react";
import type { SessionType } from "@/lib/generated/prisma/client";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  clientStatus: string;
}

type BookingMode = "single" | "recurring";

const DURATION_OPTIONS = [
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 9, label: "9 months" },
  { value: 12, label: "12 months" },
];

export function CreateBookingDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  // Credits
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [useCredit, setUseCredit] = useState(true);

  // Admin notes
  const [adminNotes, setAdminNotes] = useState("");

  // Recurring options
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>("weekly");
  const [recurringMonths, setRecurringMonths] = useState(6);

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

  // Dates preview expand
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Error
  const [error, setError] = useState("");

  // Config for selected session type
  const config = SESSION_TYPES.find((s) => s.type === sessionType)!;

  // Generate recurring dates preview
  const recurringDates = useMemo(() => {
    if (!recurringDate) return [];
    return generateRecurringDates(recurringDate, recurringPattern, recurringMonths);
  }, [recurringDate, recurringPattern, recurringMonths]);

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
    getClientCreditBalance(selectedClient.id)
      .then(setCreditBalance)
      .catch(() => setCreditBalance(null));
  }, [selectedClient]);

  function resetForm() {
    setStep(1);
    setSearch("");
    setSelectedClient(null);
    setSessionType("individual");
    setBookingMode("single");
    setCreditBalance(null);
    setUseCredit(true);
    setAdminNotes("");
    setRecurringPattern("weekly");
    setRecurringMonths(6);
    setRecurringDate("");
    setRecurringStartTime("");
    setRecurringEndTime("");
    setRecurringResult(null);
    setPreviewExpanded(false);
    setError("");
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) resetForm();
  }

  function handleNext() {
    if (!selectedClient) return;
    setError("");
    setStep(2);
  }

  // Single booking confirm
  function handleSingleConfirm(date: string, startTime: string, endTime: string) {
    if (!selectedClient) return;
    setError("");

    startTransition(async () => {
      try {
        const result = await adminCreateBookingAction({
          studentId: selectedClient.id,
          sessionType,
          date,
          startTime,
          endTime,
          useCredit: useCredit && !config.isFree,
          adminNotes: adminNotes.trim() || undefined,
        });
        setOpen(false);
        resetForm();
        if (result?.bookingId) {
          router.push(`/admin/bookings/${result.bookingId}`);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create booking"
        );
      }
    });
  }

  // Recurring: capture first date/time from picker, then show preview
  function handleRecurringSlotSelect(date: string, startTime: string, endTime: string) {
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
          startDate: recurringDate,
          startTime: recurringStartTime,
          endTime: recurringEndTime,
          pattern: recurringPattern,
          months: recurringMonths,
          useCredits: useCredit && !config.isFree,
          adminNotes: adminNotes.trim() || undefined,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <CalendarPlus className="h-4 w-4" />
          New Booking
        </Button>
      </DialogTrigger>
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
                  setOpen(false);
                  resetForm();
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
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

            {/* Booking mode toggle */}
            <div className="space-y-2">
              <Label>Booking Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={bookingMode === "single" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBookingMode("single")}
                  className="flex-1"
                >
                  <CalendarPlus className="mr-1.5 h-4 w-4" />
                  Single Session
                </Button>
                <Button
                  type="button"
                  variant={bookingMode === "recurring" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBookingMode("recurring")}
                  className="flex-1"
                >
                  <Repeat className="mr-1.5 h-4 w-4" />
                  Recurring Series
                </Button>
              </div>
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
                    <Label className="text-xs">Duration</Label>
                    <Select
                      value={String(recurringMonths)}
                      onValueChange={(v) => setRecurringMonths(Number(v))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Credit option */}
            {selectedClient && !config.isFree && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCredit"
                    checked={useCredit}
                    onChange={(e) => setUseCredit(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="useCredit" className="cursor-pointer">
                    Deduct session credit{bookingMode === "recurring" ? "s" : ""}
                  </Label>
                </div>
                {creditBalance !== null && (
                  <p className="text-xs text-muted-foreground">
                    Client balance: {creditBalance} credit{creditBalance !== 1 ? "s" : ""}
                    {bookingMode === "single" && useCredit && creditBalance < 1 && (
                      <span className="ml-1 text-destructive">
                        (insufficient — booking will still be created)
                      </span>
                    )}
                  </p>
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
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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

        {/* Step 2: Single booking — date/time picker */}
        {!recurringResult && step === 2 && bookingMode === "single" && (
          <div className="space-y-4">
            <SummaryBar
              client={selectedClient}
              configLabel={config.label}
              useCredit={useCredit}
              isFree={config.isFree}
              onBack={() => setStep(1)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <ReschedulePicker
              sessionType={sessionType}
              currentDate=""
              currentTime=""
              onConfirm={handleSingleConfirm}
              isPending={isPending}
              mode="new"
            />
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
                  {RECURRING_PATTERNS.find((p) => p.value === recurringPattern)?.label} for {recurringMonths} months
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
            />
          </div>
        )}

        {/* Step 2: Recurring — preview + confirm */}
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

            {/* Preview summary */}
            <div className="rounded-md border bg-muted/30 p-4 space-y-2">
              <p className="text-sm">
                <strong>{recurringDates.length} sessions</strong> from{" "}
                {format(new Date(recurringDates[0] + "T12:00:00"), "d MMM yyyy")} to{" "}
                {format(new Date(recurringDates[recurringDates.length - 1] + "T12:00:00"), "d MMM yyyy")}
              </p>
              <p className="text-sm text-muted-foreground">
                Every {RECURRING_PATTERNS.find((p) => p.value === recurringPattern)?.label.toLowerCase()} on {dayOfWeek}s at {recurringStartTime} – {recurringEndTime}
              </p>
              {!config.isFree && useCredit && creditBalance !== null && (
                <p className="text-sm text-muted-foreground">
                  Credits: {creditsAvailable} available, {creditsWillUse} will be used
                  {sessionsWithoutCredit > 0 && (
                    <span className="text-yellow-600">
                      , {sessionsWithoutCredit} session{sessionsWithoutCredit !== 1 ? "s" : ""} without credit
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Expandable date list */}
            <div className="rounded-md border">
              <button
                type="button"
                onClick={() => setPreviewExpanded(!previewExpanded)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50"
              >
                <span>All dates ({recurringDates.length})</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${previewExpanded ? "rotate-180" : ""}`}
                />
              </button>
              {previewExpanded && (
                <div className="max-h-48 overflow-y-auto border-t px-3 py-2">
                  {recurringDates.map((d) => (
                    <p key={d} className="py-0.5 text-sm text-muted-foreground">
                      {format(new Date(d + "T12:00:00"), "EEE, d MMM yyyy")} at {recurringStartTime} – {recurringEndTime}
                    </p>
                  ))}
                </div>
              )}
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
                  `Create ${recurringDates.length} Sessions`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
