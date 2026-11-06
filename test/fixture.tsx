import { render } from "solid-js/web";
import { createSignal, Show } from "solid-js";
import { Explorer, type ExplorerProps } from "../src/panel.tsx";
import { initialState, type ViewState } from "../src/state.ts";
import { styles } from "../src/styles.ts";
import type { ComposerNote } from "@opencode/plugin/gui";
const a =
  'function greet(name: string) {\n  return "hello " + name;\n}\ngreet("Yunus");';
const b = 'def greet(name):\n    return "hello " + name\ngreet("Yunus")';
function App() {
  const [session, setSession] = createSignal("session-a");
  const [files, setFiles] = createSignal<Record<string, string>>({
    "src/a.ts": a,
    "src/b.py": b,
    "README.md": "# Example project",
  });
  const [state, setState] = createSignal<Record<string, ViewState>>({});
  const [attachments, setAttachments] = createSignal<ComposerNote[]>([]),
    [draft, setDraft] = createSignal("");
  const [changed, setChanged] = createSignal(false);
  const [slow, setSlow] = createSignal(false),
    [inflight, setInflight] = createSignal(0);
  const [watched, setWatched] = createSignal<string[]>([]);
  const [request, setRequest] = createSignal<{
    path: string;
    start: number;
    end: number;
    referenceID: string;
    tick: number;
  }>();
  const [treeLoaded, setTreeLoaded] = createSignal<string[]>([]);
  const nodes = (dir: string) =>
    Object.keys(files())
      .filter((p) => p.startsWith(dir ? dir + "/" : ""))
      .map((path) => {
        const remainder = path.slice(dir ? dir.length + 1 : 0),
          name = remainder.split("/")[0];
        return {
          name,
          path: dir ? dir + "/" + name : name,
          type: remainder.includes("/") ? "directory" : "file",
          absolute: "/repo/" + path,
          ignored: false,
        };
      })
      .filter((n, i, all) => all.findIndex((a) => a.path === n.path) === i);
  const file = {
    get root() {
      return "/repo";
    },
    ready: () => true,
    resolve: (p: string) => p.replace("/repo/", ""),
    absolute: () => false,
    get: (path: string) =>
      files()[path] === undefined
        ? { path, name: path, notFound: true }
        : {
            path,
            name: path.split("/").pop(),
            loaded: true,
            content: { type: "text", content: files()[path] },
          },
    sync: async (path: string) => {
      setWatched((paths) => [...new Set([...paths, path])]);
      if (slow()) {
        setInflight((n) => n + 1);
        await new Promise((r) => setTimeout(r, 500));
        setInflight((n) => n - 1);
      }
    },
    unwatch: () => {},
    missing: (p: string) => !(p in files()),
    exists: async (p: string) => p in files(),
    search: async (q: string) =>
      Object.keys(files()).filter((p) => p.includes(q)),
    tree: {
      list: (path: string) => (treeLoaded().includes(path) ? nodes(path) : []),
      state: () => ({ loaded: true }),
      sync: async (path: string) => {
        setTreeLoaded((x) => [...x, path]);
      },
    },
  };
  const composer = {
    text: draft,
    quotable: () => true,
    attach: (note: ComposerNote) =>
      setAttachments((x) => [
        ...x.filter((n) => n.commentID !== note.commentID),
        note,
      ]),
    detach: (id: string) =>
      setAttachments((x) => x.filter((n) => n.commentID !== id)),
    update: (id: string, p: { comment?: string }) =>
      setAttachments((x) =>
        x.map((n) => (n.commentID === id ? { ...n, ...p } : n)),
      ),
    insert: (text: string) => setDraft((d) => d + text),
    focus: () => {},
  };
  const client = {
    file: {
      unwatch: async ({ path }: { path: string }) => {
        setWatched((paths) => paths.filter((p) => p !== path));
      },
      list: async ({ path }: { path: string }) => ({ data: nodes(path) }),
      read: async ({ path }: { path: string }) => {
        if (slow()) {
          setInflight((n) => n + 1);
          await new Promise((r) => setTimeout(r, 500));
          setInflight((n) => n - 1);
        }
        return new TextEncoder().encode(files()[path]);
      },
    },
  };
  const changes = {
    watch: () => () => {},
    diffs: () =>
      changed()
        ? [
            {
              file: "src/a.ts",
              patch:
                '--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,4 +1,4 @@\n function greet(name: string) {\n-  return "hello " + name;\n+  return "merhaba " + name;\n }\n greet("Yunus");',
              additions: 1,
              deletions: 1,
              status: "modified",
            },
          ]
        : [],
    kinds: () => new Map(changed() ? [["src/a.ts", "mix"]] : []),
  };
  return (
    <>
      <style>
        {styles}
        {`html,body,#root{height:100%;margin:0}#fixture-panel{height:86vh;width:min(1100px,100vw);border:1px solid #ddd}#fixture-controls{padding:5px;display:flex;gap:8px}#draft,#attachments{max-height:60px;overflow:auto;font:11px monospace}`}
      </style>
      <div id="fixture-controls">
        <button
          onClick={() =>
            setFiles((x) => {
              const next = { ...x };
              delete next["src/a.ts"];
              return next;
            })
          }
        >
          Fixture: delete
        </button>
        <button onClick={() => setSlow(true)}>Fixture: slow</button>
        <span id="inflight">{inflight()}</span>
        <span id="watched">{watched().join(",")}</span>
        <button
          onClick={() => {
            setFiles((x) => ({
              ...x,
              "src/a.ts": a.replace("hello", "merhaba"),
            }));
            setChanged(true);
          }}
        >
          Fixture: update
        </button>
        <button
          onClick={() =>
            setSession((s) => (s === "session-a" ? "session-b" : "session-a"))
          }
        >
          Fixture: switch
        </button>
        <button
          onClick={() => {
            const r = state()[session()]?.refs[0];
            if (r)
              setRequest({
                path: r.path,
                start: r.start,
                end: r.end,
                referenceID: r.id,
                tick: Date.now(),
              });
          }}
        >
          Fixture: link
        </button>
      </div>
      <div id="fixture-panel">
        <Show when={session()} keyed>
          {(key) => {
            const port = {
              get value() {
                return state()[key] ?? initialState();
              },
              set: (v: ViewState) => setState((s) => ({ ...s, [key]: v })),
            };
            return (
              <Explorer
                state={port}
                screen={
                  { file, composer } as unknown as ExplorerProps["screen"]
                }
                session={
                  {
                    key,
                    id: key,
                    directory: "/repo",
                    server: { client },
                  } as unknown as ExplorerProps["session"]
                }
                tab={{ id: "explorer", title: "Kod referansları" }}
                changes={() =>
                  changes as unknown as ReturnType<ExplorerProps["changes"]>
                }
                request={request}
              />
            );
          }}
        </Show>
      </div>
      <div id="draft">{draft()}</div>
      <div id="attachments">{JSON.stringify(attachments())}</div>
      <div id="sent">0</div>
    </>
  );
}
render(() => <App />, document.getElementById("root")!);
