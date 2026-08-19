/**
 * The first two tests are the ones that matter: a client-supplied name that would
 * execute in a spreadsheet, and a negative number that must NOT be mangled to protect
 * against it. Getting the second wrong breaks every sum in the invoice register, which
 * is how a security fix becomes a finance bug.
 *
 * Run: npm run test:csv (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvRow, csvDocument } from "./csv";

test("a formula lead is neutralised", () => {
  // Client-supplied strings reach these exports: their own name, the billing name and
  // email they typed, an EFT reference they chose.
  assert.equal(csvCell('=HYPERLINK("http://evil","Click")'), `"'=HYPERLINK(""http://evil"",""Click"")"`);
  assert.equal(csvCell("+1234"), "'+1234");
  assert.equal(csvCell("@SUM(A1:A9)"), "'@SUM(A1:A9)");
  assert.equal(csvCell("\tstartsWithTab"), "'\tstartsWithTab");
});

test("a negative NUMBER is left alone", () => {
  // The load-bearing negative-space case. `-` leads a formula AND every negative
  // amount, so blanket-prefixing it would turn a discount of -150.00 into text and
  // silently break the totals in a finance export.
  assert.equal(csvCell("-150.00"), "-150.00");
  assert.equal(csvCell(-150.5), "-150.5");
  assert.equal(csvCell("-1"), "-1");
  // But a negative-looking FORMULA is still neutralised.
  assert.equal(csvCell("-1+cmd|'/c calc'!A1"), "'-1+cmd|'/c calc'!A1");
});

test("RFC 4180 quoting still works", () => {
  assert.equal(csvCell("Smith, John"), '"Smith, John"');
  assert.equal(csvCell('He said "hi"'), '"He said ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell("plain"), "plain");
});

test("ordinary values pass through untouched", () => {
  // A escaper that mangles normal data costs more than the injection it prevents.
  for (const ok of ["Cassiel Eatock-Winnik", "cassiel@cassiel.org", "INV-2026-0042", "1500.00", "ZAR", "paid", ""]) {
    assert.equal(csvCell(ok), ok, `should pass through: ${ok}`);
  }
});

test("empty and absent are the same empty cell", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(""), "");
  assert.equal(csvCell(0), "0"); // NOT empty — zero is a real amount
});

test("rows and documents compose", () => {
  assert.equal(csvRow(["a", "b,c", null]), 'a,"b,c",');
  assert.equal(
    csvDocument(["name", "amount"], [["Smith, John", "-150.00"], ["=evil", 0]]),
    'name,amount\r\n"Smith, John",-150.00\r\n\'=evil,0',
  );
});
