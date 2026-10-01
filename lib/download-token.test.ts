import { test } from "node:test";
import assert from "node:assert/strict";

import { createDownloadToken, downloadLinksConfigured, readDownloadToken } from "./download-token";

// Read at call time, so setting it after the import is enough.
process.env.DOWNLOAD_LINK_SECRET = "test-secret-not-real";

const NOW = new Date("2026-10-01T10:00:00Z");

test("a fresh token names its student and product", () => {
  const t = createDownloadToken("stu1", "prod1", NOW);
  assert.deepEqual(readDownloadToken(t, NOW), { studentId: "stu1", productId: "prod1" });
});

test("a token still works on its last day and not after", () => {
  const t = createDownloadToken("stu1", "prod1", NOW, 30);
  assert.ok(readDownloadToken(t, new Date("2026-10-31T09:59:59Z")));
  assert.equal(readDownloadToken(t, new Date("2026-10-31T10:00:01Z")), null);
});

test("a token with a swapped product is refused — the signature covers the payload", () => {
  const t = createDownloadToken("stu1", "prod1", NOW);
  const [, sig] = t.split(".");
  const forged = `${Buffer.from(`stu1.prod2.${Math.floor(NOW.getTime() / 1000) + 86_400}`).toString("base64url")}.${sig}`;
  assert.equal(readDownloadToken(forged, NOW), null);
});

test("garbage is refused, never thrown", () => {
  for (const bad of ["", ".", "abc", "abc.def", "a.b.c", "%%%.***"]) {
    assert.equal(readDownloadToken(bad, NOW), null);
  }
});

test("with no secret configured, nothing is made and nothing is accepted", () => {
  const t = createDownloadToken("stu1", "prod1", NOW);
  delete process.env.DOWNLOAD_LINK_SECRET;
  try {
    assert.equal(downloadLinksConfigured(), false);
    assert.equal(readDownloadToken(t, NOW), null);
    assert.throws(() => createDownloadToken("stu1", "prod1", NOW));
  } finally {
    process.env.DOWNLOAD_LINK_SECRET = "test-secret-not-real";
  }
});

test("a valid token with anything appended is refused", () => {
  const t = createDownloadToken("stu1", "prod1", NOW);
  assert.equal(readDownloadToken(`${t}.junk`, NOW), null);
});

test("a token signed with another secret is refused", () => {
  const t = createDownloadToken("stu1", "prod1", NOW);
  process.env.DOWNLOAD_LINK_SECRET = "a-different-secret";
  try {
    assert.equal(readDownloadToken(t, NOW), null);
  } finally {
    process.env.DOWNLOAD_LINK_SECRET = "test-secret-not-real";
  }
});
