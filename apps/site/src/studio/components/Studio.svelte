<script lang="ts">
  import { onMount } from "svelte";

  import type { CustomDef } from "../custom.ts";
  import { downloadText, openShapeStore } from "../db.ts";
  import { DESIGN_FILE, fileKind, ioErrorKey, openLimit } from "../files.ts";
  import { decodeShare, encodeShare, shareToken, shareUrl } from "../share.ts";
  import { dropsContent, importSvg } from "../svgimport.ts";
  import { shapeOf } from "../shapes.ts";
  import { translator, type StudioMessages } from "../i18n.ts";
  import { actionFor, loadBindings, saveBindings, type Action, type Bindings } from "../shortcuts.ts";
  import { Studio } from "../store.svelte.ts";
  import { InsertError, type InsertOptions } from "../generate.ts";
  import type { Scene } from "@0xdolan/deq-generator";
  import Canvas from "./Canvas.svelte";
  import ExportDialog from "./ExportDialog.svelte";
  import GeneratePanel from "./GeneratePanel.svelte";
  import Inspector from "./Inspector.svelte";
  import Layers from "./Layers.svelte";
  import LeetPanel from "./LeetPanel.svelte";
  import Library from "./Library.svelte";
  import ShapeEditor from "./ShapeEditor.svelte";
  import Shortcuts from "./Shortcuts.svelte";
  import Toolbar from "./Toolbar.svelte";

  interface Props {
    messages: StudioMessages;
    locale: "en" | "ckb" | "kmr";
  }
  let { messages, locale }: Props = $props();

  const t = $derived(translator(messages));
  const studio = new Studio();
  const apple = typeof navigator !== "undefined" && /Mac|iPhone|iPad/u.test(navigator.platform || navigator.userAgent);

  let bindings = $state<Bindings>(loadBindings(safeStorage()));
  let canvas: Canvas | undefined = $state();
  let library: Library | undefined = $state();
  let shortcuts: Shortcuts | undefined = $state();
  let exporter: ExportDialog | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();
  /** A visible message from open, save or share; `link` holds a share link to copy by hand. */
  let notice = $state<{ text: string; error: boolean; link?: string } | undefined>();
  /** Which panel shows on narrow screens. */
  let panel = $state<"library" | "canvas" | "inspector">("canvas");
  /** Which list the left pane shows. */
  let side = $state<"library" | "layers" | "leet" | "generate">("library");
  let ready = $state(false);
  /** The shape editor: closed, or open on a shape (null for a new one). */
  let editing = $state<{ def: CustomDef | undefined; n: number } | undefined>();
  let edits = 0;

  function openEditor(def?: CustomDef): void {
    editing = { def, n: ++edits };
  }

  function safeStorage(): Storage | undefined {
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  }

  onMount(() => {
    studio.load();
    void openShapeStore().then((store) => studio.useShapeStore(store));
    void openShared();
    ready = true;
  });

  function tell(text: string, error = false, link?: string): void {
    notice = link === undefined ? { text, error } : { text, error, link };
    studio.announce(text);
  }

  /** Open the design in a share link (`#d=…`), then drop it from the address bar. */
  async function openShared(): Promise<void> {
    const token = shareToken(location.hash);
    if (token === undefined) return;
    history.replaceState(history.state, "", location.pathname + location.search);
    try {
      studio.openDoc(await decodeShare(token), t("studio.act.open"));
      tell(t("studio.io.sharedOpened"));
    } catch (error) {
      tell(t(ioErrorKey(error)), true);
    }
  }

  async function openFile(file: File): Promise<void> {
    const kind = fileKind(file.name, file.type);
    try {
      if (file.size > openLimit(kind)) {
        tell(t("studio.io.error.size"), true);
        return;
      }
      const text = await file.text();
      const label = t("studio.act.open");
      if (kind === "svg") {
        const def = await importSvg(text, file.name);
        await studio.saveCustom(def, label);
        const added = t("studio.io.imported", { name: def.name });
        tell(dropsContent(text) ? `${added} ${t("studio.io.dropped")}` : added);
        side = "library";
        return;
      }
      const result = await studio.openJson(text, label);
      if (result === "design") tell(t("studio.io.opened", { name: file.name }));
      else {
        tell(t("studio.io.imported", { name: result.name }));
        side = "library";
      }
    } catch (error) {
      tell(t(ioErrorKey(error)), true);
    }
  }

  async function share(): Promise<void> {
    let url: string;
    try {
      url = shareUrl(location.href.split("#")[0] ?? location.href, await encodeShare(studio.doc));
    } catch (error) {
      tell(t(ioErrorKey(error)), true);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      tell(t("studio.io.shared"), false, url);
    } catch {
      tell(t("studio.io.error.clipboard"), true, url);
    }
  }

  const viewport = () => canvas?.size() ?? { w: 800, h: 600 };

  function add(shape: string, at?: { x: number; y: number }): void {
    const names = shapeOf(shape).names;
    const name = (locale === "en" ? null : names[locale].text) ?? names.en;
    const item = studio.add(shape, t("studio.act.add", { name }), at, viewport());
    if (item) {
      studio.announce(t("studio.act.add", { name }));
      panel = "canvas";
    }
  }

  /** Add a Leet text or a pattern from the side panels as one group. */
  function insertScene(scene: Scene, insert: Omit<InsertOptions, "x" | "y">): void {
    try {
      const ids = studio.insertScene(scene, insert, t("studio.act.insertScene"), viewport());
      studio.announce(t("studio.scene.inserted", { count: ids.length }));
      panel = "canvas";
    } catch (e) {
      if (!(e instanceof InsertError)) throw e;
      tell(t(e.limit === "items" ? "studio.scene.full.items" : "studio.scene.full.shapes"), true);
    }
  }

  function run(action: Action): void {
    const { w, h } = viewport();
    const sel = studio.selection;
    const nudge = (dx: number, dy: number) => studio.moveBy(sel, dx, dy, t("studio.act.move"), "nudge");
    switch (action) {
      case "undo": {
        const label = studio.undo();
        if (label) studio.announce(t("studio.undone", { label }));
        break;
      }
      case "redo": {
        const label = studio.redo();
        if (label) studio.announce(t("studio.redone", { label }));
        break;
      }
      case "delete":
        studio.remove(sel, t("studio.act.delete"));
        break;
      case "duplicate":
        studio.duplicate(sel, t("studio.act.duplicate"));
        break;
      case "selectAll":
        studio.selectAll();
        break;
      case "deselect":
        studio.deselect();
        break;
      case "nudgeLeft":
        nudge(-1, 0);
        break;
      case "nudgeRight":
        nudge(1, 0);
        break;
      case "nudgeUp":
        nudge(0, -1);
        break;
      case "nudgeDown":
        nudge(0, 1);
        break;
      case "nudgeLeftBig":
        nudge(-10, 0);
        break;
      case "nudgeRightBig":
        nudge(10, 0);
        break;
      case "nudgeUpBig":
        nudge(0, -10);
        break;
      case "nudgeDownBig":
        nudge(0, 10);
        break;
      case "zoomIn":
        studio.zoomIn(w, h);
        break;
      case "zoomOut":
        studio.zoomOut(w, h);
        break;
      case "zoomReset":
        studio.zoomTo(1, w, h);
        break;
      case "zoomFit":
        studio.fit(w, h);
        break;
      case "toggleGrid":
        studio.toggle("grid");
        break;
      case "toggleKeylines":
        studio.toggle("keylines");
        break;
      case "togglePixels":
        studio.toggle("pixels");
        break;
      case "toggleRulers":
        studio.toggle("rulers");
        break;
      case "toggleSnap":
        studio.toggle("snap");
        break;
      case "group":
        act(() => studio.group(t("studio.act.group")), "studio.act.group");
        break;
      case "ungroup":
        act(() => studio.ungroup(t("studio.act.ungroup")), "studio.act.ungroup");
        break;
      case "bringForward":
      case "sendBackward":
      case "bringToFront":
      case "sendToBack":
        act(() => studio.arrange(ORDERS[action], t("studio.act.order")), "studio.act.order");
        break;
      case "toggleLock":
        act(() => studio.setFlag(sel, "locked", t("studio.act.lock")), "studio.act.lock");
        break;
      case "toggleHide":
        act(() => studio.setFlag(sel, "hidden", t("studio.act.hide")), "studio.act.hide");
        break;
      case "alignLeft":
      case "alignHCenter":
      case "alignRight":
      case "alignTop":
      case "alignVCenter":
      case "alignBottom":
        act(() => studio.align(EDGES[action], t("studio.act.align")), "studio.act.align");
        break;
      case "distributeH":
      case "distributeV":
        act(() => studio.distribute(action === "distributeH" ? "x" : "y", t("studio.act.distribute")), "studio.act.distribute");
        break;
      case "search":
        panel = "library";
        side = "library";
        queueMicrotask(() => library?.focusSearch());
        break;
      case "help":
        shortcuts?.open();
        break;
      case "open":
        fileInput?.click();
        break;
      case "save":
        downloadText(DESIGN_FILE, `${JSON.stringify(studio.doc, null, 2)}\n`);
        tell(t("studio.io.saved", { name: DESIGN_FILE }));
        break;
      case "share":
        void share();
        break;
      case "export":
        exporter?.open();
        break;
    }
  }

  const ORDERS = { bringForward: "forward", sendBackward: "backward", bringToFront: "front", sendToBack: "back" } as const;
  const EDGES = {
    alignLeft: "left", alignHCenter: "hcenter", alignRight: "right",
    alignTop: "top", alignVCenter: "vcenter", alignBottom: "bottom",
  } as const;

  /** Run an edit and announce it when it changed the design. */
  function act(edit: () => void, key: "studio.act.group" | "studio.act.ungroup" | "studio.act.order" | "studio.act.lock" | "studio.act.hide" | "studio.act.align" | "studio.act.distribute"): void {
    const before = studio.doc;
    edit();
    if (studio.doc !== before) studio.announce(t(key));
  }

  /** Actions that need a selection. */
  const NEEDS_SELECTION = new Set<Action>([
    "group", "ungroup", "bringForward", "sendBackward", "bringToFront", "sendToBack", "toggleLock", "toggleHide",
    "alignLeft", "alignHCenter", "alignRight", "alignTop", "alignVCenter", "alignBottom", "distributeH", "distributeV",
  ]);

  const NUDGES = new Set<Action>([
    "nudgeLeft", "nudgeRight", "nudgeUp", "nudgeDown",
    "nudgeLeftBig", "nudgeRightBig", "nudgeUpBig", "nudgeDownBig", "delete",
  ]);

  function keydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || editing || shortcuts?.isOpen() || exporter?.isOpen()) return;
    const target = e.target as HTMLElement | null;
    const inField = !!target?.closest("input, textarea, select, [contenteditable]");
    const action = actionFor(bindings, e, apple, inField);
    if (!action) return;
    // Arrow keys and Delete act on the canvas only, so they keep working in lists and dialogs.
    if (NUDGES.has(action) && target && target !== document.body && !target.closest(".studio-canvas")) return;
    if (studio.selection.length === 0 && (NUDGES.has(action) || NEEDS_SELECTION.has(action))) return;
    e.preventDefault();
    run(action);
  }

  function changeBindings(next: Bindings): void {
    bindings = next;
    saveBindings(safeStorage(), next);
  }
</script>

<svelte:window onkeydown={keydown} />

<div class="studio" class:ready data-panel={panel}>
  <Toolbar {studio} {t} {apple} {bindings} {run} />
  <input
    bind:this={fileInput}
    class="file-input"
    type="file"
    accept=".json,.svg,application/json,image/svg+xml"
    tabindex="-1"
    aria-hidden="true"
    onchange={(e) => {
      const file = e.currentTarget.files?.[0];
      e.currentTarget.value = "";
      if (file) void openFile(file);
    }}
  />
  <div class="notices">
  {#if notice}
    <div class="notice" class:error={notice.error} role={notice.error ? "alert" : "status"}>
      <span>{notice.text}</span>
      {#if notice.link}
        <input type="text" readonly value={notice.link} aria-label={t("studio.io.copyLink")} onfocus={(e) => e.currentTarget.select()} />
      {/if}
      <button type="button" aria-label={t("studio.export.cancel")} onclick={() => (notice = undefined)}>×</button>
    </div>
  {/if}
  </div>
  <div class="panes">
    <div class="pane pane-library" id="studio-pane-library">
      <div class="side-tabs" role="group" aria-label={t("studio.panels")}>
        {#each [["library", "studio.tab.library"], ["layers", "studio.tab.layers"], ["leet", "studio.tab.leet"], ["generate", "studio.tab.generate"]] as const as [id, key] (id)}
          <button type="button" data-side={id} aria-pressed={side === id} onclick={() => (side = id)}>{t(key)}</button>
        {/each}
      </div>
      <div class="side-body" hidden={side !== "library"}>
        <Library bind:this={library} {t} {locale} {studio} onadd={(id) => add(id)} onedit={openEditor} />
      </div>
      {#if side === "layers"}
        <div class="side-body">
          <Layers {studio} {t} {locale} />
        </div>
      {:else if side === "leet"}
        <div class="side-body side-panel">
          <LeetPanel {messages} mode="studio" oninsert={insertScene} />
        </div>
      {:else if side === "generate"}
        <div class="side-body side-panel">
          <GeneratePanel {messages} mode="studio" oninsert={insertScene} />
        </div>
      {/if}
    </div>
    <div class="pane pane-canvas studio-canvas" id="studio-pane-canvas">
      <Canvas bind:this={canvas} {studio} {t} onadd={(id, at) => add(id, at)} />
    </div>
    <div class="pane pane-inspector" id="studio-pane-inspector">
      <Inspector {studio} {t} {run} />
    </div>
  </div>
  <nav class="tabs" aria-label={t("studio.view")}>
    {#each [["library", "studio.library"], ["canvas", "studio.canvas"], ["inspector", "studio.inspector"]] as const as [id, key] (id)}
      <button type="button" aria-pressed={panel === id} aria-controls={`studio-pane-${id}`} onclick={() => (panel = id)}>{t(key)}</button>
    {/each}
  </nav>
  <p class="sr-only" role="status" aria-live="polite">{studio.announcement}</p>
  {#if editing}
    {#key editing.n}
      <ShapeEditor {studio} {t} {locale} def={editing.def} onclose={() => (editing = undefined)} />
    {/key}
  {/if}
  <Shortcuts bind:this={shortcuts} {t} {bindings} {apple} onchange={changeBindings} />
  <ExportDialog bind:this={exporter} {studio} {t} />
</div>

<style>
  .studio {
    position: relative;
    --studio-h: calc(100dvh - var(--sl-nav-height, 3.5rem) - 2rem);
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    height: var(--studio-h);
    min-height: 26rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--sl-color-bg);
  }
  .file-input {
    display: none;
  }
  .notice {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.375rem 0.75rem;
    font-size: var(--sl-text-sm);
    border-block-end: 1px solid var(--sl-color-gray-5);
    background: var(--sl-color-accent-low);
  }
  .notice.error {
    background: var(--sl-color-red-low, #3f1d1d);
  }
  .notice span {
    flex: 1;
  }
  .notice input {
    flex: 2;
    min-width: 0;
  }
  .panes {
    display: grid;
    grid-template-columns: 17rem minmax(0, 1fr) 20rem;
    min-height: 0;
  }
  .pane {
    min-height: 0;
    min-width: 0;
  }
  .pane-library {
    border-inline-end: 1px solid var(--sl-color-gray-5);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .side-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem 0;
  }
  .side-body {
    min-height: 0;
  }
  .side-body[hidden] {
    display: none;
  }
  .side-panel {
    overflow: auto;
    padding: 0.75rem;
  }
  .pane-inspector {
    border-inline-start: 1px solid var(--sl-color-gray-5);
  }
  .tabs {
    display: none;
  }
  .studio :global(.panel-title) {
    font-size: var(--sl-text-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0.75rem 0.75rem 0.5rem;
    color: var(--sl-color-gray-2);
  }
  .studio :global(.field) {
    display: grid;
    gap: 0.125rem;
    font-size: var(--sl-text-sm);
  }
  .studio :global(input:not([type="checkbox"], [type="range"], [type="color"])),
  .studio :global(select) {
    font: inherit;
    font-size: var(--sl-text-sm);
    padding: 0.3rem 0.45rem;
    border: 1px solid var(--sl-color-gray-4);
    border-radius: 0.375rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-white);
    min-height: 2rem;
  }
  .studio :global(button) {
    font: inherit;
    font-size: var(--sl-text-sm);
    padding: 0.3rem 0.6rem;
    min-height: 2rem;
    border: 1px solid var(--sl-color-gray-4);
    border-radius: 0.375rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-white);
    cursor: pointer;
  }
  .studio :global(button[aria-pressed="true"]) {
    background: var(--sl-color-accent-low);
    border-color: var(--sl-color-accent);
  }
  .studio :global(button:disabled) {
    opacity: 0.45;
    cursor: default;
  }
  .studio :global(button:focus-visible),
  .studio :global(input:focus-visible),
  .studio :global(select:focus-visible) {
    outline: 2px solid var(--sl-color-accent);
    outline-offset: 1px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Narrow screens: one pane at a time, switched with the tab bar at the bottom. */
  @media (max-width: 60rem) {
    .studio {
      --studio-h: calc(100dvh - var(--sl-nav-height, 3.5rem) - 1rem);
      border-radius: 0;
      border-inline: 0;
    }
    .panes {
      grid-template-columns: minmax(0, 1fr);
    }
    .pane {
      display: none;
      border: 0;
    }
    .studio[data-panel="library"] .pane-library {
      display: grid;
    }
    .studio[data-panel="canvas"] .pane-canvas,
    .studio[data-panel="inspector"] .pane-inspector {
      display: block;
    }
    .tabs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.25rem;
      padding: 0.375rem;
      border-block-start: 1px solid var(--sl-color-gray-5);
    }
    .tabs button {
      min-height: 2.75rem;
    }
  }
</style>
