import type { OpenCodeClient } from "@opencode/client/promise";
import { validPath } from "./references.ts";
export type SearchHit = { path: string; line: number; text: string };
export async function searchProject(
  client: OpenCodeClient,
  directory: string,
  query: string,
  signal: AbortSignal,
  progress: (count: number) => void,
) {
  const paths: string[] = [],
    dirs = [""];
  let limited = false,
    errors = 0,
    visited = 0;
  // Host file listings honor the workspace boundary. No shell commands and no writes.
  while (dirs.length && paths.length < 2000 && visited < 2000) {
    signal.throwIfAborted();
    visited++;
    const result = await client.file.list(
      { location: { directory }, path: dirs.shift()! },
      { signal },
    );
    for (const entry of result.data) {
      if (
        !validPath(entry.path) ||
        /(^|\/)(\.git|node_modules|vendor|dist|build|\.next)(\/|$)/.test(
          entry.path,
        )
      )
        continue;
      if (entry.type === "directory") dirs.push(entry.path);
      else if (paths.length < 2000) paths.push(entry.path);
      else limited = true;
    }
  }
  limited ||= dirs.length > 0;
  const hits: SearchHit[] = [];
  let cursor = 0,
    scanned = 0;
  const needle = query.toLowerCase();
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (cursor < paths.length && hits.length < 200) {
        signal.throwIfAborted();
        const path = paths[cursor++];
        try {
          const bytes = await client.file.read(
            { location: { directory }, path },
            { signal },
          );
          if (bytes.length > 512_000 || bytes.includes(0)) {
            limited = true;
            continue;
          }
          const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          for (const [index, line] of text.split(/\r?\n/).entries()) {
            if (hits.length >= 200) {
              limited = true;
              break;
            }
            if (line.toLowerCase().includes(needle))
              hits.push({ path, line: index + 1, text: line.slice(0, 300) });
          }
        } catch (error) {
          if (signal.aborted) throw error;
          errors++;
        } finally {
          scanned++;
          progress(scanned);
        }
      }
    }),
  );
  return {
    hits: hits.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line),
    limited: limited || cursor < paths.length,
    errors,
    scanned,
  };
}
