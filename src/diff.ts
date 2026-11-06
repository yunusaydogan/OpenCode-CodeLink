export function patchSides(patch: string) {
  const before: string[] = [],
    after: string[] = [];
  let inHunk = false;
  for (const line of patch.split("\n")) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      inHunk = true;
      before.push(`⋯ line ${hunk[1]}`);
      after.push(`⋯ line ${hunk[2]}`);
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("-")) before.push(line.slice(1));
    else if (line.startsWith("+")) after.push(line.slice(1));
    else if (line.startsWith(" ")) {
      before.push(line.slice(1));
      after.push(line.slice(1));
    }
  }
  return { before: before.join("\n"), after: after.join("\n") };
}
