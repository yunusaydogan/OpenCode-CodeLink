import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
test("installer preserves JSONC comments and other plugins, backs up once, is idempotent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "code-ref install "));
  try {
    const config = join(dir, "opencode.jsonc");
    const original =
      '{\n // Keep this comment\n "plugins": ["other-plugin"],\n "model":"test/model",\n}\n';
    await writeFile(config, original);
    const install = () =>
      execFileSync(
        process.execPath,
        ["scripts/install.mjs", "--config-dir", dir],
        { cwd: resolve("."), encoding: "utf8" },
      );
    assert.match(install(), /CodeLink registered in:/);
    const installed = await readFile(config, "utf8");
    assert.match(installed, /Keep this comment/);
    assert.match(installed, /other-plugin/);
    assert.match(installed, /test\/model/);
    assert.ok(installed.includes(resolve(".")));
    assert.match(install(), /CodeLink is already registered/);
    assert.equal(await readFile(config, "utf8"), installed);
    const backups = (await readdir(dir)).filter((p) => p.includes(".bak-"));
    assert.equal(backups.length, 1);
    assert.equal(await readFile(join(dir, backups[0]), "utf8"), original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("installer rejects invalid plugins configuration without modifying it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "code-ref-invalid-"));
  try {
    const config = join(dir, "opencode.json"),
      original = '{"plugins":"invalid"}';
    await writeFile(config, original);
    assert.throws(() =>
      execFileSync(
        process.execPath,
        ["scripts/install.mjs", "--config-dir", dir],
        { encoding: "utf8", stdio: "pipe" },
      ),
    );
    assert.equal(await readFile(config, "utf8"), original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
