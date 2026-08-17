/**
 * Redirect destinations that came from a request.
 *
 * A `?next=` or `?redirect=` parameter is attacker-controlled input that ends up
 * in a Location header, so it decides which site the user lands on. Four places
 * had their own copy of the check and all four were wrong in the same way — they
 * tested `startsWith("/")`, which does not survive contact with a URL parser:
 *
 *   `${origin}${next}` with next = "@evil.com"  → https://life-therapy.co.za@evil.com
 *                                                  ...host is evil.com (userinfo trick)
 *   `${origin}${next}` with next = ".evil.com"  → https://life-therapy.co.za.evil.com
 *                                                  ...host is the attacker's subdomain
 *   redirect("//evil.com")                       → protocol-relative, off-origin
 *
 * The first two need no leading slash at all, so the guard everyone wrote could
 * not have caught them. That mattered: the auth callback is reachable with a
 * valid token an attacker gets from the ordinary forgot-password flow, so the
 * link they distribute genuinely begins with life-therapy.co.za and still lands
 * on their site.
 */

/**
 * CR, LF and other control characters — one in a Location header can split it.
 *
 * Tested by code point rather than a regex class: the literal control characters
 * such a class needs are invisible in source and get mangled by anything that
 * rewrites the file.
 */
function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * A path safe to redirect to: same-origin, absolute, and nothing else.
 *
 * Returns `fallback` for anything it cannot vouch for, rather than throwing —
 * a login that lands somewhere sensible beats a login that 500s.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;

  // Exactly one leading slash. "//host" and "/\host" are both read as
  // protocol-relative by browsers, and anything without a leading slash can
  // graft itself onto the origin as userinfo or as a subdomain.
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;

  // Refuse rather than strip: a sanitised redirect target is a guess about what
  // the caller meant.
  if (hasControlChars(next)) return fallback;

  return next;
}

/**
 * Build an absolute redirect URL from an untrusted path.
 *
 * Uses the URL constructor rather than string concatenation, which is the other
 * half of the bug: concatenating first and parsing afterwards is what let the
 * host be rewritten in the examples above.
 */
export function safeRedirectUrl(
  next: string | null | undefined,
  origin: string,
  fallback: string,
): URL {
  return new URL(safeNextPath(next, fallback), origin);
}
