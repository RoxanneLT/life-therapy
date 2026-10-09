/**
 * How an audit_logs row reads to a person — shared by the client Activity tab and the
 * super-admin Audit log page, so one action never reads two ways.
 *
 * Labels default to the action name in sentence case ("client_tags_updated" → "Client tags
 * updated"). An entry here is only for a name that reads badly that way; a new action needs
 * nothing added to show up.
 */
const LABELS: Record<string, string> = {
  student_record_viewed: "Viewed client record",
  booking_record_viewed: "Viewed session record",
  data_exported: "Exported data",
  client_data_exported: "Exported this client's data",
  client_erased: "Erased client (POPIA)",
  booking_no_show: "Marked no-show",
  admin_mfa_removed: "Removed admin two-factor",
  login_failure: "Sign-in failed",
  login_success: "Signed in",
  mfa_failure: "Two-factor failed",
  mfa_success: "Two-factor passed",
};

function auditActionLabel(action: string): string {
  const known = LABELS[action];
  if (known) return known;
  const words = action.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A view or an export: a read, which the feeds can filter out of the way of the changes. */
export function isReadAction(action: string): boolean {
  return action.endsWith("_record_viewed") || action === "data_exported" || action === "client_data_exported";
}

const MAX_VALUE = 80;

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text;
}

/**
 * The fields a before/after pair changed, as "field: old → new". Values are truncated, and a
 * field present on one side only still shows. Audit writers record ids, flags and short values,
 * never note text (a notes edit records the field's name only), so this does not surface content
 * the record itself withholds.
 */
function describeChanges(before: unknown, after: unknown): string[] {
  const b = before && typeof before === "object" && !Array.isArray(before) ? (before as Record<string, unknown>) : {};
  const a = after && typeof after === "object" && !Array.isArray(after) ? (after as Record<string, unknown>) : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => (k in b ? `${k}: ${show(b[k])} → ${show(a[k])}` : `${k}: ${show(a[k])}`));
}

export interface AuditFeedRow {
  id: string;
  action: string;
  label: string;
  entityType: string;
  entityId: string;
  actorEmail: string;
  createdAt: string;
  changes: string[];
  metadata: Record<string, unknown> | null;
}

export function toFeedRow(row: {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorEmail: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: Date;
}): AuditFeedRow {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : null;
  return {
    id: row.id,
    action: row.action,
    label: auditActionLabel(row.action),
    entityType: row.entityType,
    entityId: row.entityId,
    actorEmail: row.actorEmail,
    createdAt: row.createdAt.toISOString(),
    changes: describeChanges(row.before, row.after),
    metadata,
  };
}
