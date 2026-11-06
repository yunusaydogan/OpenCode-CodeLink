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
    <section class="cr-basket" aria-label="Referans sepeti">
      <header class="cr-section-head">
        <button
          onClick={() => setCollapsed(!collapsed())}
          aria-expanded={!collapsed()}
        >
          {collapsed() ? "▸" : "▾"} Referanslar{" "}
          <span class="cr-count">{props.refs.length}</span>
        </button>
        <div>
          <button
            aria-pressed={history()}
            onClick={() => setHistory(!history())}
          >
            Geçmiş
          </button>
          <button onClick={props.clear} disabled={!props.refs.length}>
            Sepeti temizle
          </button>
        </div>
      </header>
      <Show when={!collapsed()}>
        <Show
          when={props.refs.length}
          fallback={
            <p class="cr-empty-small">
              Kod seçip sağ tıklayarak sohbete referans ekleyin. Farklı
              dosyalardan seçimler bir arada kalır.
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
                        aria-label="Karşılaştırmaya seç"
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
                        aria-label="Referansı çıkar"
                        title="Sohbet taslağından çıkar"
                        onClick={() => props.remove(ref.id)}
                      >
                        ×
                      </button>
                    </div>
                    <Show when={status()?.changed}>
                      <span class="cr-stale">
                        Seçimden sonra değişti
                        {status()?.exact
                          ? " · yeni konumu bulundu"
                          : " · yeniden seçim gerekebilir"}
                      </span>
                    </Show>
                    <Show when={!status()}>
                      <span class="cr-muted">
                        Güncel dosya henüz doğrulanamadı
                      </span>
                    </Show>
                    <pre
                      class="cr-preview"
                      onClick={() => props.snapshot(ref)}
                      title="Seçim anındaki kodu aç"
                    >
                      {ref.code.split("\n").slice(0, 3).join("\n")}
                    </pre>
                    <input
                      class="cr-note"
                      aria-label="Referans notu"
                      placeholder="Not ekle: hata burada, bunun gibi olmalı…"
                      value={ref.note}
                      onInput={(e) => props.note(ref.id, e.currentTarget.value)}
                    />
                    <div class="cr-ref-actions">
                      <button onClick={() => props.snapshot(ref)}>
                        Sabit kopya
                      </button>
                      <button onClick={() => props.expand(ref)}>
                        Çevresini ekle
                      </button>
                    </div>
                  </article>
                );
              }}
            </For>
          </div>
          <div class="cr-pair">
            <span>{props.selected.length}/2 seçili</span>
            <button
              disabled={props.selected.length !== 2}
              onClick={() => props.pair("compare")}
            >
              Karşılaştır
            </button>
            <button
              disabled={props.selected.length !== 2}
              onClick={() => props.pair("relate")}
            >
              Bağlantıyı açıkla
            </button>
            <button
              disabled={props.selected.length !== 2}
              onClick={() => props.pair("behavior")}
            >
              Neden farklı?
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
                  <button onClick={() => props.restore(ref)}>
                    Yeniden ekle
                  </button>
                </div>
              )}
            </For>
            <Show when={!props.history.length}>
              <p class="cr-empty-small">Henüz referans yok.</p>
            </Show>
          </div>
        </Show>
      </Show>
    </section>
  );
}
