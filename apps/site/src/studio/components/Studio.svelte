<script lang="ts">
  import { getShape } from "@0xdolan/deq-core";
  import { onMount } from "svelte";

  import { translator, type StudioMessages } from "../i18n.ts";
  import { actionFor, loadBindings, saveBindings, type Action, type Bindings } from "../shortcuts.ts";
  import { Studio } from "../store.svelte.ts";
  import Canvas from "./Canvas.svelte";
  import Inspector from "./Inspector.svelte";
  import Layers from "./Layers.svelte";
  import Library from "./Library.svelte";
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
  /** Which panel shows on narrow screens. */
  let panel = $state<"library" | "canvas" | "inspector">("canvas");
  /** Which list the left pane shows. */
  let side = $state<"library" | "layers">("library");
  let ready = $state(false);

  function safeStorage(): Storage | undefined {
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  }

  onMount(() => {
    studio.load();
    ready = true;
  });

  const viewport = () => canvas?.size() ?? { w: 800, h: 600 };

  function add(shape: string, at?: { x: number; y: number }): void {
    const names = getShape(shape).names;
    const name = (locale === "en" ? null : names[locale].text) ?? names.en;
    const item = studio.add(shape, t("studio.act.add", { name }), at, viewport());
    if (item) {
      studio.announce(t("studio.act.add", { name }));
      panel = "canvas";
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
    if (e.defaultPrevented || shortcuts?.isOpen()) return;
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
  <div class="panes">
    <div class="pane pane-library" id="studio-pane-library">
      <div class="side-tabs" role="group" aria-label={t("studio.panels")}>
        {#each [["library", "studio.tab.library"], ["layers", "studio.tab.layers"]] as const as [id, key] (id)}
          <button type="button" data-side={id} aria-pressed={side === id} onclick={() => (side = id)}>{t(key)}</button>
        {/each}
      </div>
      <div class="side-body" hidden={side !== "library"}>
        <Library bind:this={library} {t} {locale} onadd={(id) => add(id)} />
      </div>
      {#if side === "layers"}
        <div class="side-body">
          <Layers {studio} {t} {locale} />
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
  <Shortcuts bind:this={shortcuts} {t} {bindings} {apple} onchange={changeBindings} />
</div>

<style>
  .studio {
    --studio-h: calc(100dvh - var(--sl-nav-height, 3.5rem) - 2rem);
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: var(--studio-h);
    min-height: 26rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--sl-color-bg);
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
