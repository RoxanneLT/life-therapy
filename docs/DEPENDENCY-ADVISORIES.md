# Dependency advisories — what is carried, and what would change the answer

`npm audit` reported **7 vulnerabilities (1 moderate, 6 high)** on 2026-09-09, after the
Dependabot batch of 28 updates landed. Four were fixed. **Three are carried deliberately**,
plus the one rollup entry npm counts alongside them.

This file exists because a raw advisory count is not a decision. Seven high-severity findings
against a counselling platform that holds client records and payment data reads as an
emergency; none of the seven is reachable from a request this application serves, and saying
so once — with the trace, and with what would have to become true for it to stop being true —
is cheaper than the next person re-deriving it under time pressure and reaching for
`--force`.

**This list is NOT probed, and that is a real gap.** Every other allowlist in this repo fails
the build when an entry stops firing (`allowlists: every exemption is still load-bearing`).
This one cannot: deciding whether an entry is still live means asking the GitHub advisory
database, and `npm run check` runs in a pre-commit hook that must work on a plane. So it is a
*dated* decision log, not a mechanism, and it goes stale the ordinary way. Re-read it whenever
`npm audit` moves.

---

## Fixed — `npm audit fix`, non-breaking, 7 → 4

Each of these was a transitive bump inside a range the parent already allowed. No direct
dependency changed version.

| Package | Severity | Reached the tree via |
|---|---|---|
| `fast-uri` 3.1.5 | high ×4 — SSRF, host confusion | `prisma` → `@prisma/dev` → `@prisma/streams-local` → `ajv@8` |
| `js-yaml` 4.3.1 | high — CPU exhaustion on empty merge sources | `eslint` → `@eslint/eslintrc` |
| `fflate` 0.8.2 | moderate — `unzipSync` infinite loop on malformed ZIP64 | `jspdf` |

`fflate` is the only one of the seven that was ever inside a production code path: `jspdf`
generates invoices (`lib/generate-invoice-pdf.ts`) and certificates
(`app/api/certificates/download/route.ts`). Even there the vulnerable function is not called —
every jspdf `dist` build references `zlibSync` (compression), the UMD build additionally
`inflateSync`, and none of them `unzipSync`. It was taken because it was free, not because it
was urgent.

### One trace that was wrong, recorded because it is repeatable

`@hookform/resolvers` was removed in the same commit as an unused production dependency, and
the reasoning that found it was sound. The reasoning that *connected it to `fast-uri`* was
not.

`npm ls fast-uri` printed `@hookform/resolvers → ajv@8 → fast-uri`, which reads as
provenance. It is not an edge: `@hookform/resolvers` declares `ajv` as an **optional peer**,
npm installs peers, and `npm ls` attributes a hoisted package to *one* dependent rather than
listing every requirer. Uninstalling it removed exactly one package and left the count at 7.

**A single `npm ls` path is a hypothesis, not a provenance.** What disproved it was the
advisory count not moving — a measurement, taken because the fix was expected to show. The
general form is in `dev-standards/LESSONS.md` territory: a tool that answers "which dependent"
when the real question is "which dependents" gives a confident singular answer to a plural
question.

---

## Carried — the Prisma CLI subtree

Four npm entries, one subtree: `deepmerge-ts` → `@prisma/config` → `prisma`, and `mysql2` →
`prisma`. npm's only offered fix is **`prisma@6.19.3`** — a **major version downgrade** from
7.10.0, across `prisma`, `@prisma/client`, `@prisma/adapter-pg` and the generated client at
`lib/generated/prisma`.

**The trade is refused.** Downgrading the working data layer of a live platform by a major
version, to close advisories on code paths this project does not execute, costs more than it
buys. The decision is `prisma@7.10.0` stays.

### `mysql2` — high ×2

> Auth plugin downgrade to `mysql_clear_password` leaks plaintext credentials ·
> Unbounded zlib inflate in the compressed MySQL protocol handler (decompression-bomb DoS)

Both are properties of an active MySQL **connection**. This project has none. `DATABASE_URL`
is the Supabase pgbouncer pooler, PostgreSQL, reached through `@prisma/adapter-pg` and `pg`
(`.claude/rules/schema-changes.md`). `mysql2` is bundled by the Prisma CLI so that one binary
can serve every engine; nothing loads it without a MySQL connection string.

**What would change the answer:** this project acquiring a MySQL data source. It will not by
accident — a second database is a schema decision, and §5 of CLAUDE.md makes those explicit.

### `deepmerge-ts` — high

> Stack exhaustion when merging recursive object graphs

`@prisma/config` uses it to merge the CLI's configuration layers. The input is this repo's own
config, read at build time by `prisma generate`. A stack exhaustion needs an adversary who can
supply a recursive object graph; the adversary here would be whoever can already edit our
build config, and they have better options.

**What would change the answer:** Prisma config becoming reachable from request-time code.
It is not — `@prisma/client@7.10.0`'s only runtime dependency is `@prisma/client-runtime-utils`.

### The accounting footnote worth knowing

`npm audit --omit=dev` **still reports this subtree**, which looks like it contradicts
"dev-only". It does not. `@prisma/client@7.10.0` declares `"prisma": "*"` as a
**peerDependency**, npm auto-installs peers, so npm's production graph contains the CLI even
though `package.json` lists `prisma` under `devDependencies`.

That is a packaging artefact, not a runtime fact. On Vercel the CLI runs once, at build
(`"build": "prisma generate && next build"`), and is never loaded serving a request. Do not
read `--omit=dev` here as evidence the CLI ships to production — check what actually imports
it.

---

## How to re-check this file

```bash
npm audit                 # the current count
npm ls <package> --all    # a hypothesis about provenance, not an answer — see above
npm audit --omit=dev      # read with the peerDependency footnote in hand
```

Then ask the question this file is organised around, which is not "is there a CVE" but: **is
the vulnerable function on a path this application executes, with input someone outside the
building controls?** For all four carried entries the answer is no, on 2026-09-09.

If a fix arrives that does not require the downgrade — Prisma shipping a patched
`@prisma/config` or `mysql2` inside 7.x — it is an ordinary minor bump. Take it and delete the
corresponding section here.
