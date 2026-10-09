import { saFormat } from "@/lib/dates";

/**
 * What arrived for this client and was NOT applied, because the record already held a different
 * value. upsertContact fills blank fields only (lib/contacts.ts, owner's ruling 2026-10-09), and
 * records each mismatch as a `contact_field_conflict` audit entry rather than silently dropping it.
 * Read-only: if an incoming value is the right one (a client's new number), edit the record.
 * Phone numbers are never shown here, by design: the audit log is not encrypted, so it never
 * holds one.
 */
export interface ContactConflict {
  id: string;
  createdAt: Date;
  metadata: unknown;
}

const FIELD_LABEL: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
  gender: "Gender",
};

const SOURCE_LABEL: Record<string, string> = {
  booking: "a booking",
  newsletter: "a newsletter signup",
  import: "a CSV import",
};

type Fields = Record<string, { stored?: unknown; incoming?: unknown }>;

function read(metadata: unknown): { source: string; fields: Fields } {
  const m = (metadata ?? {}) as { source?: unknown; fields?: unknown };
  return {
    source: typeof m.source === "string" ? m.source : "unknown",
    fields: m.fields && typeof m.fields === "object" ? (m.fields as Fields) : {},
  };
}

export function ContactConflicts({ entries }: Readonly<{ entries: ContactConflict[] }>) {
  if (entries.length === 0) return null;
  return (
    <details className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <summary className="cursor-pointer font-medium">
        Contact details that didn&apos;t match ({entries.length})
      </summary>
      <p className="mt-2 text-muted-foreground">
        These arrived for this client but were not applied, because the record already held a
        different value. If one is correct, edit the client&apos;s details.
      </p>
      <ul className="mt-2 space-y-2">
        {entries.map((e) => {
          const { source, fields } = read(e.metadata);
          return (
            <li key={e.id}>
              <span className="text-muted-foreground">
                {saFormat(e.createdAt, "d MMM yyyy, HH:mm")} · from {SOURCE_LABEL[source] ?? source}
              </span>
              <ul className="ml-4 list-disc">
                {Object.entries(fields).map(([field, v]) => (
                  <li key={field}>
                    {FIELD_LABEL[field] ?? field}:{" "}
                    {field === "phone" ? (
                      "a different number was given (not stored, for privacy)"
                    ) : (
                      <>
                        kept <strong>{String(v.stored ?? "")}</strong>, received{" "}
                        <strong>{String(v.incoming ?? "")}</strong>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
