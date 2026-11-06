// Isolated real OpenCode server, with no model/API call and no changes to the user's sessions.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { OpenCode } from "@opencode/client/promise";
const base = await mkdtemp(join(tmpdir(), "code-reference-smoke-"));
const config = join(base, "config");
await mkdir(config);
await writeFile(
  join(config, "opencode.json"),
  JSON.stringify({ plugins: [resolve(".")] }),
);
const env = {
  ...process.env,
  OPENCODE_CONFIG_DIR: config,
  OPENCODE_CONFIG_CONTENT: "{}",
  OPENCODE_DB: join(base, "db.sqlite"),
  XDG_CONFIG_HOME: join(base, "xdg-config"),
  XDG_DATA_HOME: join(base, "data"),
  XDG_CACHE_HOME: join(base, "cache"),
  XDG_STATE_HOME: join(base, "state"),
  OPENCODE_DISABLE_MODELS_FETCH: "true",
};
delete env.OPENCODE_CONFIG;
delete env.OPENCODE_SERVER_PASSWORD;
const child = spawn(
  process.env.OPENCODE_BIN ?? "/opt/OpenCode/resources/opencode-cli",
  ["serve", "--hostname", "127.0.0.1", "--port", "0"],
  { cwd: base, env, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "",
  errors = "";
child.stdout.on("data", (b) => (output += b));
child.stderr.on("data", (b) => (errors += b));
try {
  let url, password;
  for (let i = 0; i < 400; i++) {
    url = output.match(/server listening on (http:\/\/[^\s]+)/)?.[1];
    password = output.match(/server password ([^\s]+)/)?.[1];
    if (url && password) break;
    if (child.exitCode !== null)
      throw Error("The isolated OpenCode test server exited early.");
    await delay(50);
  }
  assert.ok(url && password, "Server startup timeout");
  const client = OpenCode.make({
    baseUrl: url,
    headers: {
      Authorization:
        "Basic " + Buffer.from("opencode:" + password).toString("base64"),
    },
  });
  let plugins;
  for (let i = 0; i < 100; i++) {
    plugins = await client.plugin.list({ location: { directory: base } });
    if (JSON.stringify(plugins).includes("opencode-code-reference")) break;
    await delay(100);
  }
  assert.ok(
    JSON.stringify(plugins).includes("opencode-code-reference"),
    "GUI-only plugin absent from native plugin registry",
  );
  const bundle = await client.plugin.gui({
    id: "opencode-code-reference",
    location: { directory: base },
  });
  assert.ok(
    JSON.stringify(bundle).length > 10000,
    "Native host did not serve the GUI bundle",
  );
  // Exercise the exact read/list APIs used by project search against a real workspace.
  await writeFile(join(base, "hello.ts"), 'export const hello = "welcome";');
  const listing = await client.file.list({
    location: { directory: base },
    path: "",
  });
  assert.ok(listing.data.some((e) => e.path === "hello.ts"));
  const bytes = await client.file.read({
    location: { directory: base },
    path: "hello.ts",
  });
  assert.match(new TextDecoder().decode(bytes), /welcome/);
  console.log(
    "PASS: OpenCode 2.2.5 registered GUI-only plugin, served bundle, listed and read project files.",
  );
} catch (error) {
  // Never print server output: it contains temporary authentication credentials.
  console.error(error.message);
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await Promise.race([new Promise((r) => child.once("exit", r)), delay(3000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
  await rm(base, { recursive: true, force: true });
}
