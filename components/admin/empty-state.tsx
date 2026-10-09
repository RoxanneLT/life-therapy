import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  readonly icon?: LucideIcon;
  /** What is missing, e.g. "No campaigns yet." */
  readonly message: string;
  /** What to do about it, or why it is empty. */
  readonly description?: React.ReactNode;
  readonly action?: React.ReactNode;
  /**
   * A bordered card of its own — the default, for a page or tab with nothing to list. Pass `false`
   * inside something that already has a frame, such as a table row.
   */
  readonly framed?: boolean;
}

/** The one "nothing here" for admin lists, so an empty page has the same outline as a full one. */
export function EmptyState({ icon: Icon, message, description, action, framed = true }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-4 text-center",
        framed ? "rounded-lg border border-dashed bg-card py-12" : "py-8",
      )}
    >
      {Icon && <Icon className="mb-3 h-10 w-10 text-muted-foreground/50" />}
      <p className="font-medium text-muted-foreground">{message}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
