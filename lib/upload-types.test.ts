/**
 * An upload's storage key is built from things the server chose (L-102). The first test is the known-good
 * half: every type an uploader offers still gets its extension, so the fix did not refuse real uploads.
 * The rest are the refusals: a type the bucket does not take, a type another bucket takes, a key that
 * only an object's prototype holds, and a value that is not a string at all.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { UPLOAD_TYPES, isUploadBucket, uploadExtension, uploadPath } from "./upload-types";

test("every type an uploader offers is taken, under the extension the map names", () => {
  assert.equal(uploadExtension("images", "image/jpeg"), "jpg");
  assert.equal(uploadExtension("images", "image/svg+xml"), "svg");
  assert.equal(uploadExtension("products", "application/pdf"), "pdf");
  assert.equal(
    uploadExtension("products", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "xlsx",
  );
});

test("a type the bucket does not take is refused, including one another bucket takes", () => {
  assert.equal(uploadExtension("images", "application/pdf"), null);
  assert.equal(uploadExtension("products", "image/svg+xml"), null);
  assert.equal(uploadExtension("images", "text/html"), null);
  assert.equal(uploadExtension("images", ""), null);
});

test("only the map's own keys count, and a non-string is refused", () => {
  assert.equal(uploadExtension("images", "constructor"), null);
  assert.equal(uploadExtension("images", "__proto__"), null);
  assert.equal(uploadExtension("images", undefined), null);
  assert.equal(uploadExtension("images", ["image/png"]), null);
  assert.equal(isUploadBucket("images"), true);
  assert.equal(isUploadBucket("toString"), false);
  assert.equal(isUploadBucket("avatars"), false);
});

test("a key holds one segment under uploads/, and nothing a URL parser could read as a dot segment", () => {
  for (const types of Object.values(UPLOAD_TYPES)) {
    for (const ext of Object.values(types)) {
      const path = uploadPath(ext);
      assert.match(path, /^uploads\/\d+-[a-z0-9]+\.[a-z]+$/);
      assert.equal(path.endsWith(`.${ext}`), true);
    }
  }
});
