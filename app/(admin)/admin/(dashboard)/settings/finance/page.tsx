import { requireRole } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { FinanceSettingsForm } from "@/components/admin/finance-settings-form";
import {
  getEffectiveBillingDate,
  getEffectiveDueDate,
  getReminderDate,
  getOverdueDate,
} from "@/lib/billing";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function FinanceSettingsPage() {
  await requireRole("super_admin");
  const settings = await getSiteSettings();

  // Compute next month's effective dates for the preview
  const now = new Date();
  const nextMonth = now.getMonth() + 2; // 1-indexed for next month
  const year = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
  const month = nextMonth > 12 ? 1 : nextMonth;

  const billingDate = getEffectiveBillingDate(year, month, settings.postpaidBillingDay);
  const dueDate = getEffectiveDueDate(year, month, settings.postpaidDueDay);
  const reminderDate = getReminderDate(dueDate);
  const overdueDate = getOverdueDate(dueDate);

  const nextDates = {
    billing: format(billingDate, "EEE d MMM yyyy"),
    due: format(dueDate, "EEE d MMM yyyy"),
    reminder: format(reminderDate, "EEE d MMM yyyy"),
    overdue: format(overdueDate, "EEE d MMM yyyy"),
  };

  return (
    <FinanceSettingsForm initialSettings={settings} nextDates={nextDates} />
  );
}
