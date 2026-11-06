import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capture,
  locate,
  expand,
  attachment,
  parseLink,
  MAX_SNAPSHOT,
  pairQuestion,
} from "../src/references.ts";

test("line selection ending at next line start excludes that next line", () => {
  const ref = capture("src/a.ts", "one\ntwo\nthree\n", 1, 8);
  assert.equal(ref.start, 1);
  assert.equal(ref.end, 2);
  assert.equal(ref.code, "one\ntwo");
});
test("snapshot remains frozen when file changes and relocates by unique matching block", () => {
  const ref = capture("a.ts", "first\nselected\nlast", 6, 14);
  assert.deepEqual(locate(ref, "inserted\nfirst\nselected\nlast"), {
    start: 3,
    end: 3,
    changed: true,
    exact: true,
  });
  assert.equal(ref.code, "selected");
  assert.equal(locate(ref, "replaced").exact, false);
});
test("ambiguous repeated code is never claimed to be relocated exactly", () => {
  const ref = capture("a", "x\ntarget", 2, 8);
  assert.equal(locate(ref, "target\nx\ntarget").exact, false);
});
test("staleness detects changes elsewhere in the file without altering snapshot", () => {
  const ref = capture("a", "x\ny", 0, 1);
  assert.equal(locate(ref, "x\nz").changed, true);
  assert.equal(locate(ref, "x\ny").changed, false);
});
test("expansion captures surrounding lines and rejects deleted selection", () => {
  const ref = capture("a", "a\nb\nc\nd", 2, 3);
  const expanded = expand(ref, "a\nb\nc\nd", 1);
  assert.equal(expanded.code, "a\nb\nc");
  assert.equal(expanded.start, 1);
  assert.throws(() => expand(ref, "changed", 2), /bulunamadı/);
});
test("reject empty, oversized, invalid and external paths", () => {
  assert.throws(() => capture("a", "abc", 1, 1));
  assert.throws(() =>
    capture("a", "a".repeat(MAX_SNAPSHOT + 1), 0, MAX_SNAPSHOT + 1),
  );
  assert.throws(() => capture("../secret", "a", 0, 1));
  assert.throws(() => capture("/etc/passwd", "a", 0, 1));
  assert.throws(() => capture("a", "a", 0, 4));
});
test("attachment includes immutable quoted content and safe navigable link", () => {
  const ref = capture("src/a b.ts", "const a = 1;", 0, 12);
  const note = attachment(ref, "opencode-code-reference");
  assert.equal(note.type, "note");
  assert.match(note.subject, /> const a = 1;/);
  const parsed = parseLink(note.href!);
  assert.equal(parsed?.path, ref.path);
  assert.equal(parsed?.id, ref.id);
  assert.equal(parseLink("https://evil.test/a"), undefined);
  assert.equal(
    parseLink("oc-code-ref://reference?id=x&path=..%2Fsecret&start=1&end=2"),
    undefined,
  );
});
test("pair questions name both refs and require two selections", () => {
  const a = capture("a.ts", "one", 0, 3),
    b = capture("b.ts", "two", 0, 3);
  assert.match(pairQuestion([a, b], "compare"), /a.ts/);
  assert.match(pairQuestion([a, b], "relate"), /bağlantı/);
  assert.throws(() => pairQuestion([a], "compare"));
});
test("reference link and snapshot retain the originating workspace", () => {
  const ref = capture("src/a.ts", "one", 0, 3, "/projects/my app");
  assert.equal(
    parseLink(attachment(ref, "opencode-code-reference").href!)?.directory,
    "/projects/my app",
  );
  assert.match(attachment(ref, "opencode-code-reference").subject, /my app/);
});
