import { createEffect, onMount, onCleanup } from "solid-js";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  keymap,
  drawSelection,
} from "@codemirror/view";
import {
  syntaxHighlighting,
  HighlightStyle,
  StreamLanguage,
} from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { normalize } from "./references.ts";
import { tags } from "@lezer/highlight";

const codeColors = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--cr-code-keyword,#8245a2)" },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--cr-code-string,#a84430)",
  },
  {
    tag: [tags.number, tags.bool, tags.null],
    color: "var(--cr-code-number,#17696b)",
  },
  {
    tag: tags.comment,
    color: "var(--cr-code-comment,#6e7a80)",
    fontStyle: "italic",
  },
  {
    tag: [tags.function(tags.variableName), tags.definition(tags.variableName)],
    color: "var(--cr-code-function,#205faa)",
  },
  {
    tag: [tags.typeName, tags.className],
    color: "var(--cr-code-type,#1d7370)",
  },
]);

export type Reveal = { start: number; end: number; tick: number };
export type CodeSelection = {
  text: string;
  from: number;
  to: number;
  path: string;
};
export function language(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext!))
    return javascript({
      typescript: ext?.startsWith("ts"),
      jsx: ext?.endsWith("x"),
    });
  if (ext === "py") return python();
  if (["json", "jsonc"].includes(ext!)) return json();
  if (["html", "vue", "svelte"].includes(ext!)) return html();
  if (["css", "scss", "less"].includes(ext!)) return css();
  if (["md", "mdx"].includes(ext!)) return markdown();
  if (["sh", "bash", "zsh"].includes(ext!)) return StreamLanguage.define(shell);
  if (["yml", "yaml"].includes(ext!)) return StreamLanguage.define(yaml);
  return [];
}
export function CodeEditor(props: {
  text: string;
  path: string;
  reveal?: Reveal;
  onSelection?: (s: CodeSelection) => void;
  onContext?: (x: number, y: number) => void;
  label?: string;
}) {
  let root!: HTMLDivElement, view: EditorView | undefined;
  const lang = new Compartment();
  onMount(() => {
    view = new EditorView({
      parent: root,
      state: EditorState.create({
        doc: normalize(props.text),
        extensions: [
          EditorState.readOnly.of(true),
          lineNumbers(),
          highlightActiveLineGutter(),
          drawSelection(),
          keymap.of(searchKeymap),
          highlightSelectionMatches(),
          syntaxHighlighting(codeColors),
          lang.of(language(props.path)),
          EditorView.contentAttributes.of({
            "aria-label": props.label ?? "Read-only code",
          }),
          EditorView.updateListener.of((update) => {
            if (update.selectionSet || update.docChanged) {
              const s = update.state.selection.main;
              props.onSelection?.({
                text: update.state.doc.toString(),
                from: s.from,
                to: s.to,
                path: props.path,
              });
            }
          }),
          EditorView.domEventHandlers({
            mousedown(event, editor) {
              // A context click must not replace the code selection with the clicked cursor position.
              if (
                event.button === 2 &&
                props.onContext &&
                !editor.state.selection.main.empty
              ) {
                event.preventDefault();
                return true;
              }
              return false;
            },
            contextmenu(event) {
              if (!props.onContext) return false;
              event.preventDefault();
              props.onContext(event.clientX, event.clientY);
              return true;
            },
          }),
          EditorView.theme({
            "&": {
              height: "100%",
              fontSize: "13px",
              backgroundColor: "transparent",
            },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily:
                '"DejaVu Sans Mono", "SFMono-Regular", Consolas, monospace',
            },
            ".cm-gutters": {
              backgroundColor: "var(--cr-surface)",
              color: "var(--cr-muted)",
              border: "none",
            },
            ".cm-content": { padding: "12px 0" },
            "&.cm-focused": { outline: "none" },
            ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
              backgroundColor:
                "color-mix(in srgb, var(--cr-accent) 28%, transparent)",
            },
            ".cm-activeLineGutter": { backgroundColor: "var(--cr-hover)" },
            ".cm-panels": {
              backgroundColor: "var(--cr-surface)",
              color: "var(--cr-text)",
            },
            ".cm-searchMatch": { backgroundColor: "#d5a62e50" },
          }),
        ],
      }),
    });
  });
  createEffect(() => {
    const text = normalize(props.text),
      path = props.path;
    // Effects run after the component mounts, so the first render already owns its view.
    if (!view) return;
    const changed = view.state.doc.toString() !== text;
    if (changed) {
      const old = view.state.selection.main;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: {
          anchor: Math.min(old.anchor, text.length),
          head: Math.min(old.head, text.length),
        },
      });
    }
    view.dispatch({ effects: lang.reconfigure(language(path)) });
  });
  createEffect(() => {
    const r = props.reveal;
    // Content is a dependency so a reveal also applies after an async file load.
    props.text;
    if (!view || !r) return;
    const start = view.state.doc.line(
      Math.max(1, Math.min(r.start, view.state.doc.lines)),
    );
    const end = view.state.doc.line(
      Math.max(1, Math.min(r.end, view.state.doc.lines)),
    );
    view.dispatch({
      selection: { anchor: start.from, head: end.to },
      effects: EditorView.scrollIntoView(start.from, { y: "center" }),
    });
  });
  onCleanup(() => view?.destroy());
  return <div class="cr-editor" ref={root} />;
}
