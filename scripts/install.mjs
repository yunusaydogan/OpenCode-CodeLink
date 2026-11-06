import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rename,
  lstat,
  unlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { parse, modify, applyEdits } from "jsonc-parser";

const args = process.argv.slice(2);
const index = args.indexOf("--config-dir");
if (args.length && (index !== 0 || args.length !== 2))
  throw Error("Usage: node scripts/install.mjs [--config-dir CONFIG_DIR]");
const directory =
  index === 0
    ? resolve(args[1])
    : join(
        process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
        "opencode",
      );
const root = resolve(import.meta.dirname, "..");
await readFile(join(root, "dist/gui-experimental.cjs")); // Never register an unbuilt plugin.
await mkdir(directory, { recursive: true });
let config = join(directory, "opencode.json"),
  source = "{}\n",
  mode = 0o600,
  exists = false;
for (const name of ["opencode.json", "opencode.jsonc"]) {
  const path = join(directory, name);
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink())
      throw Error(
        `Symlinked config files are not modified automatically: ${path}`,
      );
    source = await readFile(path, "utf8");
    config = path;
    mode = stat.mode & 0o777;
    exists = true;
    break;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const errors = [];
const value = parse(source, errors, { allowTrailingComma: true });
if (
  errors.length ||
  !value ||
  typeof value !== "object" ||
  Array.isArray(value)
)
  throw Error("The OpenCode config must be a valid JSON/JSONC object.");
if (value.plugins !== undefined && !Array.isArray(value.plugins))
  throw Error("The OpenCode plugins setting must be an array.");
const plugins = value.plugins ?? [];
if (plugins.some((p) => p === root || p?.package === root)) {
  console.log("CodeLink is already registered. Open the panel in OpenCode.");
} else {
  const next = applyEdits(
    source,
    modify(source, ["plugins"], [...plugins, root], {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
    }),
  );
  const backup = `${config}.bak-${Date.now()}`;
  if (exists) await copyFile(config, backup);
  const temporary = `${config}.code-reference-${process.pid}`;
  try {
    await writeFile(temporary, next, { mode, flag: "wx" });
    await rename(temporary, config);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  console.log(`CodeLink registered in: ${config}`);
  if (exists) console.log(`Previous config backed up to: ${backup}`);
  console.log("In OpenCode, choose + → CodeLink. Restart the app if needed.");
}
