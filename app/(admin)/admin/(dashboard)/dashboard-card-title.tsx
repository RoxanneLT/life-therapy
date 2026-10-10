import type { ComponentType, ReactNode } from "react";
import { CardTitle } from "@/components/ui/card";

/**
 * Every dashboard card's heading: its icon on the left, then the title. One shape, so they match.
 * Always one line: a title too long for a narrow card truncates rather than wrapping under the icon,
 * and its full text is the tooltip.
 */
export function DashboardCardTitle({
  icon: Icon,
  children,
}: Readonly<{ icon: ComponentType<{ className?: string }>; children: ReactNode }>) {
  return (
    <CardTitle className="flex min-w-0 items-center gap-2 text-base font-medium">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate" title={typeof children === "string" ? children : undefined}>
        {children}
      </span>
    </CardTitle>
  );
}
