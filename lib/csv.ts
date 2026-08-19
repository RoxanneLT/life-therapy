/**
 * lib/csv.ts — the ONE escaper every exported CSV goes through.
 *
 * There were two, defined independently in two files with byte-identical bodies:
 * `escapeCsv` in the reports actions and `escape` in the invoice export. Both handled
 * RFC 4180 quoting correctly. Neither handled FORMULA INJECTION, so the duplication was
 * not the bug — it was the reason one fix would have reached half the exports
 * (`dev-standards/LESSONS.md` L-21).
 *
 * THE RISK, concretely. Excel, LibreOffice and Google Sheets treat a cell beginning with
 * `=`, `+`, `-`, `@`, tab or carriage return as a FORMULA, not text. Every export here
 * carries client-supplied strings — a client's own name, the billing name and email they
 * typed, an EFT reference they chose — straight into a spreadsheet that Roxanne opens.
 * A client called `=HYPERLINK("http://evil","Click")` executes on open. Quoting does not
 * help: the spreadsheet strips the quotes and evaluates what is inside.
 *
 * This is the direction that matters — untrusted input into a trusted desktop
 * application — and it is not caught by anything the browser or the database does.
 */

/**
 * Cells beginning with these are executed rather than displayed.
 *
 * `-` is handled separately: a negative NUMBER is a legitimate cell and prefixing it
 * would break every spreadsheet sum in the export, so it is only neutralised when the
 * value is not a plain number.
 */
const FORMULA_LEAD = /^[=+@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * One cell, safe to write.
 *
 * Two independent jobs, in order:
 *   1. Neutralise a formula lead by prefixing an apostrophe — the standard mitigation;
 *      spreadsheets read it as "treat the rest as text" and do not display it.
 *   2. RFC 4180 quoting, so a comma, quote or newline inside the value cannot end the
 *      field or the row.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);

  const dangerous = FORMULA_LEAD.test(s) || (s.startsWith("-") && !PLAIN_NUMBER.test(s));
  if (dangerous) s = `'${s}`;

  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** One row. */
export function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(csvCell).join(",");
}

/**
 * A whole document. `\r\n` because RFC 4180 says so and because Excel on Windows — the
 * machine these are opened on — is the consumer that cares.
 */
export function csvDocument(header: (string | number | null | undefined)[], rows: (string | number | null | undefined)[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\r\n");
}
