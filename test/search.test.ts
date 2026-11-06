import { test } from "node:test";
import assert from "node:assert/strict";
import type { OpenCodeClient } from "@opencode/client/promise";
import { searchProject } from "../src/search.ts";
test("project search matches code case-insensitively and omits generated directories", async () => {
  const read: string[] = [];
  const client = {
    file: {
      list: async () => ({
        data: [
          { type: "file", path: "src/a.ts" },
          { type: "directory", path: "node_modules" },
        ],
      }),
      read: async ({ path }: { path: string }) => {
        read.push(path);
        return new TextEncoder().encode("IMPORT thing\nimport other");
      },
    },
  } as unknown as OpenCodeClient;
  const result = await searchProject(
    client,
    "/repo",
    "import",
    new AbortController().signal,
    () => {},
  );
  assert.deepEqual(
    result.hits.map((h) => h.line),
    [1, 2],
  );
  assert.deepEqual(read, ["src/a.ts"]);
});
test("project search stops before doing work after cancellation", async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    searchProject({} as OpenCodeClient, "/repo", "x", abort.signal, () => {}),
    { name: "AbortError" },
  );
});
