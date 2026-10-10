/**
 * Assessment answers are POPIA special personal information, and only a role that may read them may
 * target a campaign by them (owner's ruling, 2026-10-10). campaigns/actions.ts refuses a send, a
 * schedule and a SAVE by a campaign whose stored filters these helpers say use assessment results,
 * so a helper that answers "no" for a real assessment filter would let marketing send it. The walk
 * that found the save path (walk-oct-fixes 01, F1) also found nothing pinned these.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { usesAssessmentFilters, withoutAssessmentFilters, type AudienceFilters } from "@/lib/audience-filters";

test("each assessment filter counts on its own", () => {
  for (const key of ["behaviours", "feelings", "symptoms"] as const) {
    assert.equal(usesAssessmentFilters({ [key]: ["anxiety"] } as AudienceFilters), true, key);
  }
});

test("empty lists, other filters and no filters do not count", () => {
  assert.equal(usesAssessmentFilters(undefined), false);
  assert.equal(usesAssessmentFilters(null), false);
  assert.equal(usesAssessmentFilters({ symptoms: [] } as AudienceFilters), false);
  assert.equal(usesAssessmentFilters({ assessmentMatchMode: "any" } as AudienceFilters), false);
});

test("stripping removes every assessment key and keeps the rest", () => {
  const stripped = withoutAssessmentFilters({ symptoms: ["anxiety"], feelings: ["low"], behaviours: ["x"], assessmentMatchMode: "any" } as AudienceFilters);
  assert.equal(usesAssessmentFilters(stripped), false);
  assert.deepEqual(Object.keys(stripped ?? {}), []);
  assert.equal(withoutAssessmentFilters(undefined), undefined);
});
