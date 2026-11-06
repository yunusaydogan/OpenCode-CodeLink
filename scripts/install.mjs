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
  throw Error("Kullanım: node scripts/install.mjs [--config-dir KLASÖR]");
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
        `Sembolik bağlantı olan ayar dosyası otomatik değiştirilmiyor: ${path}`,
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
  throw Error("OpenCode ayar dosyası geçerli bir JSON/JSONC nesnesi olmalı.");
if (value.plugins !== undefined && !Array.isArray(value.plugins))
  throw Error("OpenCode plugins ayarı bir liste olmalı.");
const plugins = value.plugins ?? [];
if (plugins.some((p) => p === root || p?.package === root)) {
  console.log(
    "Kod referansları zaten kayıtlı. OpenCode içinden paneli açabilirsiniz.",
  );
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
  console.log(`Kod referansları eklendi: ${config}`);
  if (exists) console.log(`Önceki ayarlar yedeklendi: ${backup}`);
  console.log(
    "OpenCode içinde + → Kod referansları. Gerekirse uygulamayı yeniden açın.",
  );
}
