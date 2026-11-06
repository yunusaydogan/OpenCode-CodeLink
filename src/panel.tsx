import {
  For,
  Show,
  createMemo,
  createSignal,
  createEffect,
  untrack,
  onCleanup,
  onMount,
} from "solid-js";
import type { PanelProps } from "@opencode/plugin/gui";
import type { Changes } from "@opencode/plugin/gui/review";
import { CodeEditor, type CodeSelection, type Reveal } from "./editor.tsx";
import { Basket } from "./basket.tsx";
import {
  capture,
  attachment,
  expand,
  locate,
  pairQuestion,
  normalize,
  validPath,
  MAX_FILE,
  MAX_HISTORY,
  type Reference,
} from "./references.ts";
import { initialState, type StatePort, type ViewState } from "./state.ts";
import { searchProject, type SearchHit } from "./search.ts";
import { patchSides } from "./diff.ts";
import { displayName } from "./paths.ts";

export type ExplorerProps = PanelProps & {
  retainWatch?: (path: string) => boolean;
  state: StatePort;
  changes: () => Changes | undefined;
  request?: () =>
    | {
        path?: string;
        start?: number;
        end?: number;
        mode?: "files" | "text";
        referenceID?: string;
        tick: number;
      }
    | undefined;
};
export function Explorer(props: ExplorerProps) {
  const scope = props.session.key + "|" + props.session.directory;
  const current = () =>
    props.session.key + "|" + props.session.directory === scope;
  const ownerClient = props.session.server.client,
    ownerDirectory = props.session.directory;
  const watches = new Set<string>();
  const sync = (
    path: string,
    options?: { force?: boolean; silent?: boolean },
  ) => {
    watches.add(path);
    return props.screen.file.sync(path, options);
  };
  const release = (path: string) => {
    watches.delete(path);
    if (props.retainWatch?.(path)) return;
    // The screen file model follows routing. Cleanup must use the captured client and directory.
    void ownerClient.file
      .unwatch({ location: { directory: ownerDirectory }, path })
      .catch(() => {});
  };
  const [lastChange, setLastChange] = createSignal("");
  const eventAbort = new AbortController();
  const data = () => props.state.value ?? initialState();
  const update = (fn: (d: ViewState) => void) => {
    if (!current()) return;
    const d = structuredClone(data());
    fn(d);
    props.state.set(d);
  };
  const [error, setError] = createSignal(""),
    [selection, setSelection] = createSignal<CodeSelection>();
  const [reveal, setReveal] = createSignal<Reveal>(),
    [menu, setMenu] = createSignal<{ x: number; y: number }>();
  const [mode, setMode] = createSignal<"files" | "text">("files"),
    [searching, setSearching] = createSignal(false),
    [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchHit[]>([]),
    [searchInfo, setSearchInfo] = createSignal(""),
    [busy, setBusy] = createSignal(false);
  const [selected, setSelected] = createSignal<string[]>([]),
    [snapshot, setSnapshot] = createSignal<Reference>();
  const [showDiff, setShowDiff] = createSignal(false),
    [showTree, setShowTree] = createSignal(true);
  let searchInput: HTMLInputElement | undefined,
    searchAbort: AbortController | undefined,
    searchSequence = 0,
    alive = true;
  const report = (e: unknown) => {
    if (e instanceof Error && e.name === "AbortError") return;
    if (alive && current())
      setError(e instanceof Error ? e.message : String(e));
  };
  const safely = (work: () => void | Promise<void>) => {
    try {
      Promise.resolve(work()).catch(report);
    } catch (e) {
      report(e);
    }
  };
  const active = () => data().active;
  const file = () => (active() ? props.screen.file.get(active()) : undefined);
  const text = () =>
    file()?.content?.type === "text"
      ? normalize(file()!.content!.content)
      : undefined;
  const content = (path: string) => {
    const f = props.screen.file.get(path);
    return f?.notFound || f?.error || f?.content?.type !== "text"
      ? undefined
      : normalize(f.content.content);
  };
  const refs = () =>
    data()
      .basket.map((id) => data().refs.find((r) => r.id === id))
      .filter((r): r is Reference => !!r);
  const diffs = () => props.changes()?.diffs(props.session) ?? [];
  const diff = () =>
    diffs().find((d) => props.screen.file.resolve(d.file) === active());
  const sides = () => patchSides(diff()?.patch ?? "");
  let navigation = 0;
  const open = async (path: string, start?: number, end?: number) => {
    if (!validPath(path))
      throw Error("Files outside the project cannot be opened.");
    navigation++;
    update((d) => {
      if (!d.tabs.includes(path)) d.tabs.push(path);
      d.active = path;
    });
    setSelection(undefined);
    setShowDiff(false);
    setSearching(false);
    setSnapshot(undefined);
    setError("");
    if (start) setReveal({ start, end: end ?? start, tick: Date.now() });
    else setReveal(undefined);
    await sync(path); // Native host subscribes to on-disk changes.
  };
  const add = (ref: Reference) => {
    if (!props.screen.composer.quotable())
      throw Error(
        "References cannot be added right now. Switch to normal chat mode.",
      );
    if (refs().length >= 30 && !data().basket.includes(ref.id))
      throw Error(
        "The basket can hold up to 30 references. Remove some before adding more.",
      );
    props.screen.composer.attach(attachment(ref, "opencode-code-reference"));
    update((d) => {
      if (!d.refs.some((r) => r.id === ref.id)) d.refs.push(ref);
      if (!d.basket.includes(ref.id)) d.basket.push(ref.id);
      // Keep active basket references, then the newest historical snapshots.
      const activeRefs = d.refs.filter((r) => d.basket.includes(r.id));
      const history = d.refs
        .filter((r) => !d.basket.includes(r.id))
        .slice(-(MAX_HISTORY - activeRefs.length));
      d.refs = [...history, ...activeRefs].sort(
        (a, b) => a.created - b.created,
      );
    });
  };
  const addSelection = () =>
    safely(() => {
      const s = selection();
      if (!s || s.path !== active() || showDiff() || snapshot())
        throw Error("Select code in the current file first.");
      // Snapshot uses the exact buffer the user selected, even if a disk update arrives now.
      add(capture(s.path, s.text, s.from, s.to, props.session.directory));
      setMenu(undefined);
    });
  const remove = (id: string) => {
    props.screen.composer.detach(id);
    update((d) => {
      d.basket = d.basket.filter((i) => i !== id);
    });
    setSelected((ids) => ids.filter((i) => i !== id));
  };
  const openRef = (ref: Reference) =>
    safely(async () => {
      const pending = open(ref.path),
        generation = navigation;
      await pending;
      if (
        !current() ||
        !alive ||
        generation !== navigation ||
        active() !== ref.path
      )
        return;
      const now = content(ref.path);
      if (now === undefined) {
        setSnapshot(ref);
        return;
      }
      const found = locate(ref, now);
      setReveal({ ...found, tick: Date.now() });
      if (!found.exact) {
        setSnapshot(ref);
        setError(
          "The selected code could not be located in the current file. Showing the captured snapshot.",
        );
      }
    });
  const launchSearch = (kind: "files" | "text") => {
    searchAbort?.abort();
    searchSequence++;
    setBusy(false);
    setMode(kind);
    setSearching(true);
    setQuery("");
    setResults([]);
    setSearchInfo("");
    queueMicrotask(() => searchInput?.focus());
  };
  const runSearch = async () => {
    searchAbort?.abort();
    const token = ++searchSequence;
    const q = query().trim(),
      kind = mode();
    setResults([]);
    setSearchInfo("");
    if (!q) {
      setBusy(false);
      return;
    }
    const abort = new AbortController();
    searchAbort = abort;
    setBusy(true);
    const accepts = () =>
      alive &&
      current() &&
      token === searchSequence &&
      query().trim() === q &&
      mode() === kind &&
      !abort.signal.aborted;
    try {
      if (mode() === "files") {
        const paths = await props.screen.file.search(q, {
          limit: 100,
          signal: abort.signal,
        });
        if (accepts()) {
          setResults(
            paths
              .filter(validPath)
              .map((path) => ({ path, line: 0, text: "" })),
          );
          setSearchInfo(
            paths.length >= 100 ? "Showing the first 100 files." : "",
          );
        }
      } else {
        const result = await searchProject(
          props.session.server.client,
          props.session.directory,
          q,
          abort.signal,
          (n) => {
            if (accepts()) setSearchInfo(`${n} files scanned…`);
          },
        );
        if (accepts()) {
          setResults(result.hits);
          setSearchInfo(
            `${result.scanned} files scanned.${result.limited ? " Search limits: 2,000 files, 512 KB per file, 200 results." : ""}${result.errors ? ` ${result.errors} files could not be read.` : ""}`,
          );
        }
      }
    } catch (e) {
      if (accepts()) report(e);
    } finally {
      if (accepts()) setBusy(false);
    }
  };
  createEffect(() => {
    if (searching() && mode() === "files") {
      query();
      const timer = setTimeout(() => void runSearch(), 180);
      onCleanup(() => clearTimeout(timer));
    }
  });
  createEffect(() => {
    const request = props.request?.();
    if (!request) return;
    untrack(() => {
      if (request.mode) launchSearch(request.mode);
      const ref = data().refs.find((r) => r.id === request.referenceID);
      if (ref) openRef(ref);
      else if (request.path)
        safely(() => open(request.path!, request.start, request.end));
    });
  });
  createEffect(() => {
    const c = props.changes();
    if (c) {
      const dispose = c.watch(props.screen, "tree");
      onCleanup(dispose);
    }
  });
  createEffect(() => {
    const wanted = new Set([...data().tabs, ...refs().map((r) => r.path)]);
    untrack(() => {
      for (const path of wanted)
        if (validPath(path) && !watches.has(path))
          safely(() => sync(path, { silent: true }));
      for (const path of [...watches]) if (!wanted.has(path)) release(path);
    });
  });
  onMount(() => {
    safely(() => props.screen.file.tree.sync(""));
    if (active()) safely(() => sync(active()));
    for (const path of new Set(refs().map((r) => r.path)))
      safely(() => sync(path, { silent: true }));
  });
  onMount(() => {
    safely(async () => {
      if (!ownerClient.event) return;
      for await (const event of ownerClient.event.subscribe({
        types: ["filesystem.changed"],
        signal: eventAbort.signal,
      })) {
        if (!current() || !alive) return;
        if (
          event.type === "filesystem.changed" &&
          event.location?.directory === ownerDirectory
        ) {
          const path = props.screen.file.resolve(event.data.file);
          if (validPath(path)) setLastChange(path);
        }
      }
    });
  });
  onCleanup(() => {
    alive = false;
    eventAbort.abort();
    searchAbort?.abort();
    for (const path of [...watches]) release(path);
  });
  const closeTab = (path: string) => {
    navigation++;
    update((d) => {
      d.tabs = d.tabs.filter((p) => p !== path);
      if (d.active === path) d.active = d.tabs.at(-1) ?? "";
    });
    setSelection(undefined);
    setShowDiff(false);
    setSnapshot(undefined);
    if (active()) safely(() => sync(active()));
  };
  function Branch(p: { path: string; depth: number }) {
    const [expanded, setExpanded] = createSignal(p.path === "");
    const entries = createMemo(() =>
      [...props.screen.file.tree.list(p.path)]
        .filter((n) => !n.ignored)
        .sort((a, b) =>
          a.type === b.type
            ? a.name.localeCompare(b.name)
            : a.type === "directory"
              ? -1
              : 1,
        ),
    );
    return (
      <>
        <Show when={p.path !== ""}>
          <button
            aria-label={displayName(p.path)}
            class="cr-tree-row cr-dir"
            style={{ "padding-left": `${8 + p.depth * 12}px` }}
            onClick={() => {
              setExpanded(!expanded());
              if (expanded()) safely(() => props.screen.file.tree.sync(p.path));
            }}
            aria-expanded={expanded()}
          >
            <span aria-hidden="true">{expanded() ? "▾" : "▸"}</span>
            {displayName(p.path)}
          </button>
        </Show>
        <Show when={expanded()}>
          <Show when={props.screen.file.tree.state(p.path)?.error}>
            <p class="cr-empty-small">
              {props.screen.file.tree.state(p.path)?.error}
              <button
                onClick={() =>
                  safely(() =>
                    props.screen.file.tree.sync(p.path, { force: true }),
                  )
                }
              >
                Retry
              </button>
            </p>
          </Show>
          <For each={entries().map((n) => n.path)}>
            {(path) => (
              <Show
                when={
                  entries().find((n) => n.path === path)?.type === "directory"
                }
                fallback={
                  <button
                    class="cr-tree-row"
                    classList={{ "cr-active": active() === path }}
                    style={{ "padding-left": `${20 + (p.depth + 1) * 12}px` }}
                    title={path}
                    onClick={() => safely(() => open(path))}
                  >
                    <span class="cr-file-name">{displayName(path)}</span>
                    <Show
                      when={props.changes()?.kinds(props.session).has(path)}
                    >
                      <span
                        class="cr-change-dot"
                        title="Changed"
                        aria-hidden="true"
                      >
                        ●
                      </span>
                    </Show>
                  </button>
                }
              >
                <Branch path={path} depth={p.depth + 1} />
              </Show>
            )}
          </For>
        </Show>
      </>
    );
  }
  return (
    <div
      class="cr-root"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setMenu(undefined);
          setSearching(false);
          setSnapshot(undefined);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "p") {
          e.preventDefault();
          launchSearch("files");
        }
        if (
          (e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === "l"
        ) {
          e.preventDefault();
          addSelection();
        }
      }}
    >
      <header class="cr-toolbar">
        <button
          aria-label="Toggle file tree"
          aria-pressed={showTree()}
          onClick={() => setShowTree(!showTree())}
        >
          ☰
        </button>
        <strong>CodeLink</strong>
        <div class="cr-toolbar-actions">
          <button onClick={() => launchSearch("files")} title="Ctrl+P">
            Find file
          </button>
          <button onClick={() => launchSearch("text")}>Search project</button>
          <button
            disabled={!lastChange() && !diffs().length}
            onClick={() =>
              safely(() =>
                open(
                  lastChange() ||
                    props.screen.file.resolve(diffs().at(-1)!.file),
                ),
              )
            }
          >
            Go to latest change
          </button>
        </div>
      </header>
      <Show when={error()}>
        <div role="alert" class="cr-error">
          {error()}
          <button aria-label="Dismiss message" onClick={() => setError("")}>
            ×
          </button>
        </div>
      </Show>
      <Show when={searching()}>
        <section
          class="cr-search"
          aria-label={mode() === "files" ? "Find file" : "Search project"}
        >
          <div class="cr-search-input">
            <input
              ref={searchInput}
              placeholder={
                mode() === "files" ? "File name…" : "Search project text…"
              }
              value={query()}
              onInput={(e) => {
                searchAbort?.abort();
                searchSequence++;
                setBusy(false);
                setResults([]);
                setQuery(e.currentTarget.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runSearch();
                }
              }}
            />
            <button onClick={() => void runSearch()}>Search</button>
            <button
              aria-label="Close search"
              onClick={() => {
                searchAbort?.abort();
                searchSequence++;
                setBusy(false);
                setSearching(false);
              }}
            >
              ×
            </button>
          </div>
          <div class="cr-results">
            <For each={results()}>
              {(hit) => (
                <button
                  onClick={() =>
                    safely(() => open(hit.path, hit.line || undefined))
                  }
                >
                  <strong>
                    {hit.path}
                    {hit.line ? `:${hit.line}` : ""}
                  </strong>
                  <span>{hit.text}</span>
                </button>
              )}
            </For>
          </div>
          <p class="cr-muted" role="status">
            {busy() ? "Searching… " : ""}
            {searchInfo()}
            {!busy() && query() && !results().length
              ? " No results found."
              : ""}
          </p>
        </section>
      </Show>
      <div class="cr-workspace">
        <Show when={showTree()}>
          <aside class="cr-tree" aria-label="Project files">
            <div class="cr-tree-title" title={props.session.directory}>
              {props.session.directory.split("/").filter(Boolean).at(-1)}
              <button
                aria-label="Refresh file tree"
                onClick={() =>
                  safely(() => props.screen.file.tree.sync("", { force: true }))
                }
              >
                ↻
              </button>
            </div>
            <Branch path="" depth={-1} />
          </aside>
        </Show>
        <main class="cr-code-area">
          <nav class="cr-tabs" aria-label="Open files">
            <For each={data().tabs}>
              {(path) => (
                <div
                  class="cr-tab"
                  classList={{ "cr-active": active() === path }}
                >
                  <button title={path} onClick={() => safely(() => open(path))}>
                    {path.split("/").pop()}
                  </button>
                  <button
                    aria-label={`${path} — close tab`}
                    onClick={() => closeTab(path)}
                  >
                    ×
                  </button>
                </div>
              )}
            </For>
          </nav>
          <Show
            when={active()}
            fallback={
              <div class="cr-welcome">
                <strong>Select code. Ask with context.</strong>
                <p>
                  Open a file from the tree. Select the relevant lines and
                  right-click to bring code from different files into one
                  conversation.
                </p>
                <button onClick={() => launchSearch("files")}>
                  Find file <kbd>Ctrl P</kbd>
                </button>
              </div>
            }
          >
            <div class="cr-file-toolbar">
              <span title={active()}>{active()}</span>
              <span class="cr-readonly">Read-only</span>
              <button
                aria-label="Show changes"
                disabled={!diff()}
                aria-pressed={showDiff()}
                onClick={() => {
                  setShowDiff(!showDiff());
                  setSnapshot(undefined);
                  setMenu(undefined);
                  setSelection(undefined);
                }}
              >
                Before / after
              </button>
              <button
                class="cr-primary"
                disabled={
                  !selection() ||
                  selection()!.from === selection()!.to ||
                  showDiff() ||
                  !!snapshot()
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={addSelection}
              >
                Add selection to chat
              </button>
            </div>
            <Show
              when={!snapshot()}
              fallback={
                <div class="cr-snapshot">
                  <header>
                    Captured snapshot · {snapshot()!.path}:{snapshot()!.start}–
                    {snapshot()!.end}
                    <button onClick={() => setSnapshot(undefined)}>
                      Back to current file
                    </button>
                  </header>
                  <CodeEditor text={snapshot()!.code} path={snapshot()!.path} />
                </div>
              }
            >
              <Show
                when={!showDiff()}
                fallback={
                  <div class="cr-diff">
                    <div>
                      <h4>
                        Before <small>Changed sections</small>
                      </h4>
                      <CodeEditor
                        text={sides().before}
                        path={active()}
                        label="Previous code"
                      />
                    </div>
                    <div>
                      <h4>
                        After <small>Changed sections</small>
                      </h4>
                      <CodeEditor
                        text={sides().after}
                        path={active()}
                        label="Updated code"
                      />
                    </div>
                  </div>
                }
              >
                <Show
                  when={!file()?.loading}
                  fallback={<div class="cr-empty-small">Loading file…</div>}
                >
                  <Show
                    when={!file()?.error && !file()?.notFound}
                    fallback={
                      <div class="cr-empty-small">
                        {file()?.error ?? "This file no longer exists."}
                        <button
                          onClick={() =>
                            safely(() => sync(active(), { force: true }))
                          }
                        >
                          Retry
                        </button>
                      </div>
                    }
                  >
                    <Show
                      when={text() !== undefined && text()!.length <= MAX_FILE}
                      fallback={
                        <div class="cr-empty-small">
                          {file()?.content?.type === "binary"
                            ? "This is not a text file."
                            : "This view supports up to 2 million characters."}
                        </div>
                      }
                    >
                      <CodeEditor
                        text={text() ?? ""}
                        path={active()}
                        reveal={reveal()}
                        onSelection={setSelection}
                        onContext={(x, y) =>
                          setMenu({
                            x: Math.max(
                              4,
                              Math.min(x, window.innerWidth - 260),
                            ),
                            y: Math.max(
                              4,
                              Math.min(y, window.innerHeight - 170),
                            ),
                          })
                        }
                      />
                    </Show>
                  </Show>
                </Show>
              </Show>
            </Show>
            <footer class="cr-code-status">
              <span>{text()?.split("\n").length ?? 0} lines</span>
              <span>
                {selection() && selection()!.to > selection()!.from
                  ? `${selection()!.to - selection()!.from} characters selected`
                  : "Add selected lines: Ctrl+Shift+L"}
              </span>
            </footer>
          </Show>
        </main>
      </div>
      <Basket
        refs={refs()}
        history={data().refs}
        content={content}
        selected={selected()}
        toggle={(id) =>
          setSelected((ids) =>
            ids.includes(id)
              ? ids.filter((i) => i !== id)
              : [...ids.slice(-1), id],
          )
        }
        remove={remove}
        note={(id, note) => {
          update((d) => {
            const r = d.refs.find((r) => r.id === id);
            if (r) r.note = note;
          });
          props.screen.composer.update(id, { comment: note });
        }}
        open={openRef}
        snapshot={(ref) => {
          safely(() => {
            const pending = open(ref.path);
            setSnapshot(ref);
            return pending;
          });
        }}
        expand={(ref) =>
          safely(() => {
            const now = content(ref.path);
            if (now === undefined) throw Error("Load the file first.");
            const next = expand(ref, now);
            add(next);
            remove(ref.id);
          })
        }
        restore={(ref) =>
          safely(() => {
            add({ ...ref, id: crypto.randomUUID(), created: Date.now() });
          })
        }
        pair={(action) =>
          safely(() => {
            const pair = refs().filter((r) => selected().includes(r.id));
            for (const r of pair)
              props.screen.composer.attach(
                attachment(r, "opencode-code-reference"),
              );
            props.screen.composer.insert(`\n${pairQuestion(pair, action)}\n`);
            props.screen.composer.focus();
          })
        }
        clear={() => {
          for (const r of refs()) props.screen.composer.detach(r.id);
          update((d) => {
            d.basket = [];
          });
          setSelected([]);
        }}
      />
      <Show when={menu()}>
        <div
          class="cr-menu-dismiss"
          onClick={() => setMenu(undefined)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu(undefined);
          }}
        />
        <div
          class="cr-context-menu"
          role="menu"
          style={{ left: `${menu()!.x}px`, top: `${menu()!.y}px` }}
        >
          <button
            role="menuitem"
            disabled={!selection() || selection()!.from === selection()!.to}
            onClick={addSelection}
          >
            Add reference to chat
          </button>
          <button
            role="menuitem"
            disabled={!selection() || selection()!.from === selection()!.to}
            onClick={() =>
              safely(() => {
                const s = selection()!;
                add(
                  expand(
                    capture(
                      s.path,
                      s.text,
                      s.from,
                      s.to,
                      props.session.directory,
                    ),
                    s.text,
                  ),
                );
                setMenu(undefined);
              })
            }
          >
            Add with surrounding context
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setMenu(undefined);
              launchSearch("text");
            }}
          >
            Search project
          </button>
        </div>
      </Show>
    </div>
  );
}
