import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BackLink } from "./back-link";

interface PageHeaderProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Buttons at the right. */
  readonly action?: ReactNode;
  /** A back link above the title. */
  readonly back?: { href: string; to: string };
  /** Status badges or a status control, beside the title. */
  readonly badges?: ReactNode;
  /** A tab strip below the title row. */
  readonly tabs?: ReactNode;
  /**
   * Pin to the top of the scrolling content area, full-bleed with a bottom border, so primary
   * actions stay reachable while a long form scrolls beneath. The settings pages use it.
   */
  readonly sticky?: boolean;
}

/**
 * The one header for every admin page. Until 2026-10-09 there were two components (this one and
 * a SettingsPageHeader with its own back link and spacing) plus about forty hand-rolled copies.
 */
export function PageHeader({ title, description, action, back, badges, tabs, sticky }: PageHeaderProps) {
  return (
    <div
      className={cn(
        sticky && "sticky -top-6 z-20 -mx-6 -mt-6 mb-6 border-b border-border bg-background px-6 pb-4 pt-5",
      )}
    >
      {back && (
        <div className="mb-2">
          <BackLink href={back.href} to={back.to} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-bold leading-tight">{title}</h1>
            {badges}
          </div>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      {tabs && <div className="mt-3">{tabs}</div>}
    </div>
  );
}
