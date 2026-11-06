import { For, Show, createSignal } from "solid-js";
import { locate, type Reference } from "./references.ts";
export function Basket(props: {
  refs: Reference[];
  history: Reference[];
  content: (path: string) => string | undefined;
  selected: string[];
  toggle: (id: string) => void;
  remove: (id: string) => void;
  note: (id: string, note: string) => void;
  open: (ref: Reference) => void;
  snapshot: (ref: Reference) => void;
  expand: (ref: Reference) => void;
  restore: (ref: Reference) => void;
  pair: (action: "compare" | "relate" | "behavior") => void;
  clear: () => void;
}) {
  const [history, setHistory] = createSignal(false),
    [collapsed, setCollapsed] = createSignal(false);
  return (
    <section class="cr-basket" aria-label="Reference basket">
      <header class="cr-section-head">
        <button
          onClick={() => setCollapsed(!collapsed())}
          aria-expanded={!collapsed()}
        >
          {collapsed() ? "▸" : "▾"} References{" "}
          <span class="cr-count">{props.refs.length}</span>
        </button>
        <div>
          <button
            aria-pressed={history()}
            onClick={() => setHistory(!history())}
          >
            History
          </button>
          <button onClick={props.clear} disabled={!props.refs.length}>
            Clear basket
          </button>
        </div>
      </header>
      <Show when={!collapsed()}>
        <Show
          when={props.refs.length}
          fallback={
            <p class="cr-empty-small">
              Select code and right-click to add a chat reference. Selections
              from different files stay together.
            </p>
          }
        >
          <div class="cr-refs">
            <For each={props.refs}>
              {(ref) => {
                const status = () => {
                  const text = props.content(ref.path);
                  return text === undefined ? undefined : locate(ref, text);
                };
                return (
                  <article class="cr-ref">
                    <div class="cr-ref-heading">
                      <input
                        type="checkbox"
                        aria-label="Select for comparison"
                        checked={props.selected.includes(ref.id)}
                        onChange={() => props.toggle(ref.id)}
                      />
                      <button
                        class="cr-ref-link"
                        onClick={() => props.open(ref)}
                        title={ref.path}
                      >
                        {ref.path}{" "}
                        <span>
                          {ref.start}–{ref.end}
                        </span>
                      </button>
                      <button
                        aria-label="Remove reference"
                        title="Remove from chat draft"
                        onClick={() => props.remove(ref.id)}
                      >
                        ×
                      </button>
                    </div>
                    <Show when={status()?.changed}>
                      <span class="cr-stale">
                        Changed since selection
                        {status()?.exact
                          ? " · new location found"
                          : " · select again if needed"}
                      </span>
                    </Show>
                    <Show when={!status()}>
                      <span class="cr-muted">
                        Current file has not been verified yet
                      </span>
                    </Show>
                    <pre
                      class="cr-preview"
                      onClick={() => props.snapshot(ref)}
                      title="Open captured code"
                    >
                      {ref.code.split("\n").slice(0, 3).join("\n")}
                    </pre>
                    <input
                      class="cr-note"
                      aria-label="Reference note"
                      placeholder="Add a note: the bug is here, match this behavior…"
                      value={ref.note}
                      onInput={(e) => props.note(ref.id, e.currentTarget.value)}
                    />
                    <div class="cr-ref-actions">
                      <button onClick={() => props.snapshot(ref)}>
                        Snapshot
                      </button>
                      <button onClick={() => props.expand(ref)}>
                        Include context
                      </button>
                    </div>
                  </article>
                );
              }}
            </For>
          </div>
          <div class="cr-pair">
            <span>{props.selected.length}/2 selected</span>
            <button
              disabled={props.selected.length !== 2}
              onClick={() => props.pair("compare")}
            >
              Compare
            </button>
            <button
              disabled={props.selected.length !== 2}
              onClick={() => props.pair("relate")}
            >
              Explain relationship
            </button>
            <button
              disabled={props.selected.length !== 2}
              onClick={() => props.pair("behavior")}
            >
              Why different?
            </button>
          </div>
        </Show>
        <Show when={history()}>
          <div class="cr-history">
            <For each={[...props.history].reverse()}>
              {(ref) => (
                <div>
                  <button onClick={() => props.open(ref)}>
                    {ref.path}:{ref.start}–{ref.end}
                  </button>
                  <button onClick={() => props.restore(ref)}>Add again</button>
                </div>
              )}
            </For>
            <Show when={!props.history.length}>
              <p class="cr-empty-small">No references yet.</p>
            </Show>
          </div>
        </Show>
      </Show>
    </section>
  );
}
