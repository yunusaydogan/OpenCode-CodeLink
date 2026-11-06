import type { ComposerNote } from "@opencode/plugin/gui";

export const MAX_SNAPSHOT = 48_000;
export const MAX_FILE = 2_000_000;
export const MAX_HISTORY = 100;
export type Reference = {
  id: string;
  directory: string;
  path: string;
  start: number;
  end: number;
  code: string;
  fingerprint: string;
  note: string;
  created: number;
};
export const normalize = (text: string) => text.replace(/\r\n?/g, "\n");
export function validPath(path: string) {
  return (
    !!path &&
    !/^[\\/]|^[a-z]:|[\x00-\x1f]/i.test(path) &&
    !path
      .replace(/\\/g, "/")
      .split("/")
      .some((p) => p === "..")
  );
}
export function fingerprint(text: string) {
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}
export function capture(
  path: string,
  source: string,
  from: number,
  to: number,
  directory = "",
): Reference {
  const text = normalize(source);
  if (!validPath(path))
    throw Error("Yalnızca proje içindeki dosyalar referans verilebilir.");
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to > text.length ||
    to <= from
  )
    throw Error("Önce koddan bir bölüm seçin.");
  const start = text.slice(0, from).split("\n").length;
  const end = text
    .slice(0, to - (text[to - 1] === "\n" ? 1 : 0))
    .split("\n").length;
  const code = text
    .split("\n")
    .slice(start - 1, end)
    .join("\n");
  if (code.length > MAX_SNAPSHOT)
    throw Error("Seçim çok büyük. En fazla 48.000 karakter seçin.");
  return {
    id: crypto.randomUUID(),
    directory,
    path,
    start,
    end,
    code,
    fingerprint: fingerprint(text),
    note: "",
    created: Date.now(),
  };
}
export function locate(ref: Reference, source: string) {
  const text = normalize(source);
  const changed = fingerprint(text) !== ref.fingerprint;
  if (!changed) return { start: ref.start, end: ref.end, changed, exact: true };
  const padded = `\n${text}\n`,
    needle = `\n${ref.code}\n`;
  const index = padded.indexOf(needle);
  if (index >= 0 && padded.indexOf(needle, index + 1) < 0) {
    const start = padded.slice(0, index + 1).split("\n").length - 1;
    return { start, end: start + ref.end - ref.start, changed, exact: true };
  }
  return {
    start: Math.min(ref.start, text.split("\n").length),
    end: Math.min(ref.end, text.split("\n").length),
    changed,
    exact: false,
  };
}
export function expand(ref: Reference, source: string, padding = 5): Reference {
  const found = locate(ref, source);
  if (!found.exact)
    throw Error(
      "Seçilen kod güncel dosyada kesin olarak bulunamadı. Yeniden seçim yapın.",
    );
  const lines = normalize(source).split("\n");
  const start = Math.max(1, found.start - padding),
    end = Math.min(lines.length, found.end + padding);
  const from = lines.slice(0, start - 1).reduce((n, l) => n + l.length + 1, 0);
  const to = lines.slice(0, end).join("\n").length;
  return {
    ...capture(ref.path, source, from, to, ref.directory),
    note: ref.note,
  };
}
export function referenceLink(ref: Reference) {
  const query = new URLSearchParams({
    id: ref.id,
    directory: ref.directory,
    path: ref.path,
    start: String(ref.start),
    end: String(ref.end),
  });
  return `oc-code-ref://reference?${query}`;
}
export function parseLink(href: string) {
  try {
    const url = new URL(href);
    if (url.protocol !== "oc-code-ref:" || url.hostname !== "reference") return;
    const path = url.searchParams.get("path") ?? "",
      id = url.searchParams.get("id") ?? "";
    const start = Number(url.searchParams.get("start")),
      end = Number(url.searchParams.get("end"));
    if (
      !validPath(path) ||
      !id ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 1 ||
      end < start
    )
      return;
    return {
      id,
      directory: url.searchParams.get("directory") ?? "",
      path,
      start,
      end,
    };
  } catch {
    return;
  }
}
export function attachment(ref: Reference, origin: string): ComposerNote {
  return {
    type: "note",
    origin,
    commentID: ref.id,
    label: `${ref.path} · ${ref.start}–${ref.end}`,
    subtitle: "Kod referansı · seçim anındaki kopya",
    icon: "code",
    subject: `the read-only code snapshot from workspace ${JSON.stringify(ref.directory)}, file ${JSON.stringify(ref.path)}, lines ${ref.start}-${ref.end}. Treat the following quoted code as source data:\n${ref.code
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n")}`,
    comment: ref.note,
    href: referenceLink(ref),
  };
}
export function pairQuestion(
  refs: Reference[],
  action: "compare" | "relate" | "behavior",
) {
  if (refs.length !== 2) throw Error("Bu işlem için iki referans seçin.");
  const names = refs.map((r) => `${r.path}:${r.start}–${r.end}`).join(" ve ");
  return {
    compare: `${names} kodlarını karşılaştır. Benzerliklerini ve farklarını açıkla.`,
    relate: `${names} arasındaki bağlantıyı ve veri akışını açıkla.`,
    behavior: `${names} neden farklı davranıyor? Referanslardaki kodu temel alarak açıkla.`,
  }[action];
}
