import { test } from "node:test";
import assert from "node:assert/strict";
import { patchSides } from "../src/diff.ts";
test("unified diff keeps context on both sides and omits metadata", () => {
  assert.deepEqual(
    patchSides(
      "--- a/a\n+++ b/a\n@@ -1,2 +1,2 @@\n same\n-old\n+new\n\\ No newline at end of file",
    ),
    { before: "⋯ line 1\nsame\nold", after: "⋯ line 1\nsame\nnew" },
  );
});
