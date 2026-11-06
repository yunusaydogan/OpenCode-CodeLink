import { Schema } from "effect";
import { Show, createSignal } from "solid-js";
import {
  Plugin,
  Panel,
  MenuItem,
  Command,
  Style,
  Store,
  LinkHandler,
} from "@opencode/plugin/gui";
import { Changes } from "@opencode/plugin/gui/review";
import { Explorer } from "./panel.tsx";
import { initialState } from "./state.ts";
import { parseLink } from "./references.ts";
import { styles } from "./styles.ts";

const Ref = Schema.Struct({
  id: Schema.String,
  directory: Schema.String,
  path: Schema.String,
  start: Schema.Number,
  end: Schema.Number,
  code: Schema.String,
  fingerprint: Schema.String,
  note: Schema.String,
  created: Schema.Number,
});
const View = Schema.Struct({
  tabs: Schema.Array(Schema.String),
  active: Schema.String,
  refs: Schema.Array(Ref),
  basket: Schema.Array(Schema.String),
});
export default Plugin.define({
  stores: { view: Store.session(View, initialState()) },
  setup(ctx) {
    const changes = ctx.use(Changes);
    type Request = {
      path?: string;
      start?: number;
      end?: number;
      mode?: "files" | "text";
      referenceID?: string;
      tick: number;
    };
    const [requests, setRequests] = createSignal<Record<string, Request>>({});
    let tick = 0;
    const open = (mode?: "files" | "text") => {
      const session = ctx.sessions.current();
      if (!session) return;
      if (mode)
        setRequests((r) => ({ ...r, [session.key]: { mode, tick: ++tick } }));
      ctx.layout.open(`${ctx.id}:explorer`, session);
    };
    const tab = {
      id: "explorer",
      title: "CodeLink",
      closable: "compact" as const,
    };
    ctx.add(Style, styles);
    ctx.add(Panel, {
      id: "explorer",
      region: "side",
      wide: true,
      list: (input) => (input.open.includes("explorer") ? [tab] : []),
      render: (props) => (
        <Show when={props.session.key + "|" + props.session.directory} keyed>
          {(_scope) => {
            const owner = props.session;
            const store = ctx.stores.view(owner);
            const port = {
              get value() {
                const d = store.value;
                return d
                  ? {
                      tabs: [...d.tabs],
                      active: d.active,
                      refs: d.refs.map((r) => ({ ...r })),
                      basket: [...d.basket],
                    }
                  : undefined;
              },
              set: (value: ReturnType<typeof initialState>) => store.set(value),
            };
            return (
              <Show when={store.ready()} fallback={<p>Loading references…</p>}>
                <Explorer
                  {...props}
                  state={port}
                  retainWatch={(path) =>
                    ctx.layout.state(
                      `file://${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`,
                      owner,
                    ) !== "closed"
                  }
                  changes={() => {
                    const c = changes();
                    return c.status === "active" ? c.value : undefined;
                  }}
                  request={() => requests()[props.session.key]}
                />
              </Show>
            );
          }}
        </Show>
      ),
    });
    ctx.add(MenuItem, {
      id: "open",
      menu: "session.panel",
      title: "CodeLink",
      icon: "code",
      run: () => open(),
    });
    for (const command of [
      {
        id: "open",
        title: "CodeLink: Open panel",
        bind: "mod+shift+e",
        mode: undefined,
      },
      {
        id: "find",
        title: "CodeLink: Find file",
        bind: undefined,
        mode: "files" as const,
      },
      {
        id: "search",
        title: "CodeLink: Search project",
        bind: undefined,
        mode: "text" as const,
      },
    ])
      ctx.add(Command, () => ({
        ...command,
        enabled: !!ctx.sessions.current(),
        section: "session" as const,
        run: () => open(command.mode),
      }));
    ctx.add(LinkHandler, {
      priority: 100,
      match: (link) => link.origin === ctx.id && !!parseLink(link.href),
      open: (link) => {
        const ref = parseLink(link.href),
          session = link.session ?? ctx.sessions.current();
        if (!ref || !session) return;
        if (ref.directory && ref.directory !== session.location?.directory) {
          void ctx.dialogs.alert({
            title: "Reference belongs to another project",
            description: `This code was selected from ${ref.directory}. Open a conversation in that project.`,
          });
          return;
        }
        setRequests((r) => ({
          ...r,
          [session.key]: {
            path: ref.path,
            start: ref.start,
            end: ref.end,
            referenceID: ref.id,
            tick: ++tick,
          },
        }));
        ctx.layout.open(`${ctx.id}:explorer`, session, {
          background: link.background,
        });
      },
      exists: (link) => !!parseLink(link.href),
    });
  },
});
