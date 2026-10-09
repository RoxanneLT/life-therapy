import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  /** Omitted on the last crumb: the page you are on is not a link. */
  href?: string;
}

/**
 * Where a deeply nested page sits, every level a link. For the course → module → lecture chain,
 * where a single back link reached one level up and the course itself was three clicks away.
 */
export function Breadcrumbs({ items }: { readonly items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((c, i) => (
          <li key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            {c.href ? (
              <Link href={c.href} className="max-w-[16rem] truncate hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="max-w-[16rem] truncate text-foreground">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
