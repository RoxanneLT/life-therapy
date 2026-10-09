/**
 * The outline of PageHeader (components/admin/page-header.tsx): a title, a description line and,
 * when the page has one, an action button. Kept to its dimensions so the page does not jump when it
 * loads.
 */
function PageHeaderSkeleton({ action = false }: { readonly action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full rounded bg-muted" />
      </div>
      {action && <div className="h-9 w-32 rounded-md bg-muted" />}
    </div>
  );
}

export function TablePageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <PageHeaderSkeleton action />
      <div className="rounded-md border">
        <div className="border-b p-4">
          <div className="h-4 w-full max-w-xs rounded bg-muted" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
            <div className="h-4 w-1/4 rounded bg-muted" />
            <div className="h-4 w-1/4 rounded bg-muted" />
            <div className="h-4 w-1/6 rounded bg-muted" />
            <div className="ml-auto h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <PageHeaderSkeleton />
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-9 w-full rounded-md bg-muted" />
            </div>
          ))}
        </div>
        <div className="h-9 w-28 rounded-md bg-muted" />
      </div>
    </div>
  );
}

export function CardGridSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <PageHeaderSkeleton action />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-8 w-24 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
