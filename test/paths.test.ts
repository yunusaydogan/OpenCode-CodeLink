import { test } from "node:test";
import assert from "node:assert/strict";
import { displayName } from "../src/paths.ts";
test("directory labels ignore trailing forward and Windows separators", () => {
  assert.equal(displayName("src/"), "src");
  assert.equal(displayName("src/lib/"), "lib");
  assert.equal(displayName("src\\lib\\"), "lib");
  assert.equal(displayName("src/app.ts"), "app.ts");
  assert.equal(displayName("proje/öğeler/"), "öğeler");
});
