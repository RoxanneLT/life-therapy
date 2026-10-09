import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BackLinkProps {
  readonly href: string;
  /** Where it goes, e.g. "Clients" — rendered as "Back to Clients". A bare "Back" says nothing. */
  readonly to: string;
}

/**
 * The one back link above an admin page's title. Until 2026-10-09 there were four hand-rolled
 * shapes (a ghost button, an icon-only button, a Button nested inside a Link, a muted text link),
 * half of them labelled only "Back".
 */
export function BackLink({ href, to }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to {to}
    </Link>
  );
}
