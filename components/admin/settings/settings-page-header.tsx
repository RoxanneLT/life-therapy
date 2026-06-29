import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Sticky header for every settings page. Pins to the top of the scrolling
 * content area (the body scrolls beneath it). Primary actions live here on the
 * right; an optional tab strip sits below. Life-Therapy admin styling.
 */
export function SettingsPageHeader({
  title,
  description,
  actions,
  tabs,
  backHref,
  backLabel = "Settings",
}: Readonly<{
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  /** When set, shows a back eyebrow link (group pages → "Settings"). */
  backHref?: string;
  backLabel?: string;
}>) {
  return (
    <div className="sticky -top-6 z-20 -mx-6 -mt-6 mb-6 border-b border-border bg-background px-6 pb-4 pt-5">
      {backHref && (
        <Link
          href={backHref}
          className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          {backLabel}
        </Link>
      )}
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold leading-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-3">{tabs}</div>}
    </div>
  );
}
