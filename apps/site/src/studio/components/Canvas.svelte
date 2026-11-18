<script lang="ts">
  import grid from "../../../../../spec/grid.json";
  import type { Translate } from "../i18n.ts";
  import { DRAG_TYPE, itemBox, optionValue, renderOptions, type Item, type StudioDoc } from "../model.ts";
  import { renderCached } from "../render.ts";
  import { GRID, rulerStep, rulerTicks, snapBox, toCanvas } from "../snap.ts";
  import type { Studio } from "../store.svelte.ts";
  import { svgMarkup } from "../svg.ts";

  interface Props {
    studio: Studio;
    t: Translate;
    onadd: (shape: string, at: { x: number; y: number }) => void;
  }
  let { studio, t, onadd }: Props = $props();

  const RULER = 20;
  let width = $state(0);
  let height = $state(0);
  let host: HTMLDivElement | undefined = $state();
  let guides = $state<{ v: readonly number[]; h: readonly number[] }>({ v: [], h: [] });
  let pixelUrl = $state("");

  export function size(): { w: number; h: number } {
    return { w: width, h: height };
  }

  const view = $derived(studio.view);
  const vb = $derived(`${view.x} ${view.y} ${width / view.zoom} ${height / view.zoom}`);
  const selectedIds = $derived(new Set(studio.selection));
  const visible = $derived(studio.doc.items.filter((i) => !i.hidden));
  const current = $derived(studio.current);
  const px = $derived(1 / view.zoom);
  const showGrid = $derived(studio.overlays.grid && GRID * view.zoom >= 6);

  function markup(item: Item): string {
    try {
      return renderCached(item.shape, renderOptions(item, { title: "" }));
    } catch {
      return "";
    }
  }

  /** Design-grid cell size of an item in canvas px (24 units plus padding). */
  function cell(item: Item): number {
    return optionValue(item, "size") / (24 + 2 * optionValue(item, "padding"));
  }

  // Pixel preview: rasterise the current item at its real size, shown without smoothing.
  $effect(() => {
    const item = current;
    if (!studio.overlays.pixels || !item || !host) {
      pixelUrl = "";
      return;
    }
    const s = Math.round(optionValue(item, "size"));
    if (s > 512) {
      pixelUrl = "";
      return;
    }
    const color = getComputedStyle(host).color;
    let svg: string;
    try {
      svg = renderCached(item.shape, renderOptions(item, { title: "", ...(item.options.color ? {} : { color }) }));
    } catch {
      pixelUrl = "";
      return;
    }
    let cancelled = false;
    const img = new Image(s, s);
    img.onload = () => {
      if (cancelled) return;
      const c = document.createElement("canvas");
      c.width = s;
      c.height = s;
      c.getContext("2d")?.drawImage(img, 0, 0, s, s);
      pixelUrl = c.toDataURL("image/png");
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return () => {
      cancelled = true;
    };
  });

  // Pointer interaction ---------------------------------------------------------------

  type Drag =
    | { kind: "move"; id: number; before: StudioDoc; ids: string[]; start: { x: number; y: number }; origin: Map<string, { x: number; y: number }> }
    | { kind: "pan"; id: number; last: { x: number; y: number } };
  let drag: Drag | undefined;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { dist: number; zoom: number } | undefined;

  function local(e: PointerEvent | DragEvent | WheelEvent): { x: number; y: number } {
    const r = host?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }

  function itemDown(e: PointerEvent, item: Item): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    pointers.set(e.pointerId, local(e));
    if (!selectedIds.has(item.id) || e.shiftKey) studio.select(item.id, e.shiftKey);
    if (e.shiftKey) return;
    const ids = studio.selection.filter((id) => !studio.doc.items.find((i) => i.id === id)?.locked);
    if (ids.length === 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const origin = new Map(studio.doc.items.filter((i) => ids.includes(i.id)).map((i) => [i.id, { x: i.x, y: i.y }]));
    const p = local(e);
    drag = { kind: "move", id: e.pointerId, before: studio.doc, ids, start: toCanvas(view, p.x, p.y), origin };
  }

  function backgroundDown(e: PointerEvent): void {
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
      drag = undefined;
      return;
    }
    if (e.button === 0 && !e.shiftKey) studio.deselect();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { kind: "pan", id: e.pointerId, last: local(e) };
  }

  function move(e: PointerEvent): void {
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      studio.zoomBy((pinch.zoom * dist) / pinch.dist / view.zoom, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.kind === "pan") {
      studio.panBy(p.x - drag.last.x, p.y - drag.last.y);
      drag.last = p;
      return;
    }
    const at = toCanvas(view, p.x, p.y);
    let dx = at.x - drag.start.x;
    let dy = at.y - drag.start.y;
    const d = drag;
    const lead = d.before.items.find((i) => i.id === d.ids[0]);
    if (lead && studio.overlays.snap) {
      const moving = { ...itemBox(lead), x: lead.x + dx, y: lead.y + dy };
      const ids = new Set(d.ids);
      const others = d.before.items.filter((i) => !ids.has(i.id) && !i.hidden).map(itemBox);
      const snapped = snapBox(moving, others, 6 / view.zoom);
      dx = snapped.x - lead.x;
      dy = snapped.y - lead.y;
      guides = snapped.guides;
    }
    const origin = d.origin;
    studio.preview({
      ...d.before,
      items: d.before.items.map((i) => {
        const o = origin.get(i.id);
        return o ? { ...i, x: o.x + dx, y: o.y + dy } : i;
      }),
    });
  }

  function up(e: PointerEvent): void {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = undefined;
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.kind === "move") studio.commitPreview(drag.before, t("studio.act.move"));
    drag = undefined;
    guides = { v: [], h: [] };
  }

  function wheel(e: WheelEvent): void {
    e.preventDefault();
    const p = local(e);
    if (e.ctrlKey || e.metaKey) studio.zoomBy(Math.exp(-e.deltaY * 0.01), p.x, p.y);
    else studio.panBy(-e.deltaX, -e.deltaY);
  }

  // Wheel must not be passive so the page does not scroll or zoom.
  $effect(() => {
    const el = host;
    if (!el) return;
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  function dragOver(e: DragEvent): void {
    if (e.dataTransfer?.types.includes(DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }
  function drop(e: DragEvent): void {
    const id = e.dataTransfer?.getData(DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    const p = local(e);
    onadd(id, toCanvas(view, p.x, p.y));
    host?.focus();
  }

  function itemKey(e: KeyboardEvent, item: Item): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      studio.select(item.id, e.shiftKey);
    }
  }

  // Rulers -------------------------------------------------------------------------------
  const step = $derived(rulerStep(view.zoom));
  const ticksX = $derived(rulerTicks(view.x, width / view.zoom, step));
  const ticksY = $derived(rulerTicks(view.y, height / view.zoom, step));
  const fmt = (n: number) => String(Math.round(n * 100) / 100);
</script>

<div class="wrap" class:rulers={studio.overlays.rulers}>
  {#if studio.overlays.rulers}
    <svg class="ruler ruler-x" aria-hidden="true" height={RULER} width={width}>
      {#each ticksX as x (x)}
        <line x1={(x - view.x) * view.zoom} x2={(x - view.x) * view.zoom} y1={RULER * 0.45} y2={RULER} />
        <text x={(x - view.x) * view.zoom + 3} y={RULER * 0.6}>{fmt(x)}</text>
      {/each}
    </svg>
    <svg class="ruler ruler-y" aria-hidden="true" width={RULER} height={height}>
      {#each ticksY as y (y)}
        <line y1={(y - view.y) * view.zoom} y2={(y - view.y) * view.zoom} x1={RULER * 0.45} x2={RULER} />
        <text x={2} y={(y - view.y) * view.zoom - 3}>{fmt(y)}</text>
      {/each}
    </svg>
    <span class="corner" aria-hidden="true"></span>
  {/if}
  <div
    class="stage"
    bind:this={host}
    bind:clientWidth={width}
    bind:clientHeight={height}
    role="group"
    aria-label={t("studio.canvas")}
    aria-describedby="studio-canvas-help"
    tabindex="-1"
    ondragover={dragOver}
    ondrop={drop}
  >
    <p id="studio-canvas-help" class="sr-only">{t("studio.canvasHelp")}</p>
    <svg
      class="surface"
      role="presentation"
      viewBox={vb}
      width={width}
      height={height}
      onpointerdown={backgroundDown}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    >
      <defs>
        <pattern id="studio-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} class="grid-line" stroke-width={px} />
        </pattern>
        <pattern id="studio-grid-major" width={GRID * 8} height={GRID * 8} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID * 8} 0 L 0 0 0 ${GRID * 8}`} class="grid-line major" stroke-width={px} />
        </pattern>
      </defs>
      {#if showGrid}
        <rect class="grid-fill" x={view.x} y={view.y} width={width / view.zoom} height={height / view.zoom} fill="url(#studio-grid)" />
        <rect class="grid-fill" x={view.x} y={view.y} width={width / view.zoom} height={height / view.zoom} fill="url(#studio-grid-major)" />
      {/if}
      <line class="axis" x1={view.x} x2={view.x + width / view.zoom} y1="0" y2="0" stroke-width={px} />
      <line class="axis" y1={view.y} y2={view.y + height / view.zoom} x1="0" x2="0" stroke-width={px} />

      {#each visible as item (item.id)}
        {@const s = optionValue(item, "size")}
        <g
          class="item"
          class:selected={selectedIds.has(item.id)}
          class:locked={item.locked}
          data-item={item.id}
          transform={`translate(${item.x} ${item.y})`}
          role="button"
          tabindex="0"
          aria-pressed={selectedIds.has(item.id)}
          aria-label={t("studio.item", { name: item.name ?? item.shape, x: fmt(item.x), y: fmt(item.y) })}
          onpointerdown={(e) => itemDown(e, item)}
          onkeydown={(e) => itemKey(e, item)}
          onfocus={() => {
            if (!selectedIds.has(item.id)) studio.select(item.id);
          }}
        >
          <rect class="hit" width={s} height={s} />
          <g use:svgMarkup={markup(item)}></g>
        </g>
      {/each}

      {#if current}
        {@const s = optionValue(current, "size")}
        {@const c = cell(current)}
        {@const pad = optionValue(current, "padding") * c}
        <g class="overlay" transform={`translate(${current.x} ${current.y})`} pointer-events="none">
          {#if pixelUrl}
            <image href={pixelUrl} width={s} height={s} class="pixels" />
          {/if}
          {#if studio.overlays.grid && c * view.zoom >= 4}
            {#each Array.from({ length: 25 }, (_, k) => k) as k (k)}
              <line class="design-grid" class:edge={k === 0 || k === 24} x1={pad + k * c} x2={pad + k * c} y1={pad} y2={pad + 24 * c} stroke-width={px} />
              <line class="design-grid" class:edge={k === 0 || k === 24} y1={pad + k * c} y2={pad + k * c} x1={pad} x2={pad + 24 * c} stroke-width={px} />
            {/each}
          {/if}
          {#if studio.overlays.keylines}
            <g transform={`translate(${pad} ${pad}) scale(${c})`} class="keylines" stroke-width={px / c}>
              {#each grid.keylines as k (k.id)}
                {#if k.shape.type === "circle"}
                  <circle cx={k.shape.cx} cy={k.shape.cy} r={k.shape.r} />
                {:else}
                  <rect x={k.shape.x} y={k.shape.y} width={k.shape.width} height={k.shape.height} />
                {/if}
              {/each}
            </g>
          {/if}
        </g>
      {/if}

      {#each studio.selected.filter((i) => !i.hidden) as item (item.id)}
        {@const b = itemBox(item)}
        <rect class="selection" x={b.x} y={b.y} width={b.w} height={b.h} stroke-width={px * 1.5} pointer-events="none" />
      {/each}
      {#each guides.v as gx (gx)}
        <line class="guide" x1={gx} x2={gx} y1={view.y} y2={view.y + height / view.zoom} stroke-width={px} />
      {/each}
      {#each guides.h as gy (gy)}
        <line class="guide" y1={gy} y2={gy} x1={view.x} x2={view.x + width / view.zoom} stroke-width={px} />
      {/each}
    </svg>
    {#if studio.doc.items.length === 0}
      <p class="empty">{t("studio.empty")}</p>
    {/if}
  </div>
</div>

<style>
  .wrap {
    position: relative;
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template: "stage" 1fr / 1fr;
    background: var(--deq-studio-canvas, var(--sl-color-gray-7, #f6f6f6));
    color: var(--sl-color-white);
    overflow: hidden;
  }
  .wrap.rulers {
    grid-template:
      "corner rx" 20px
      "ry stage" 1fr / 20px 1fr;
  }
  .ruler {
    background: var(--sl-color-bg-nav, var(--sl-color-bg));
    display: block;
    overflow: hidden;
  }
  .ruler-x {
    grid-area: rx;
    width: 100%;
    border-block-end: 1px solid var(--sl-color-gray-5);
  }
  .ruler-y {
    grid-area: ry;
    height: 100%;
    border-inline-end: 1px solid var(--sl-color-gray-5);
  }
  .corner {
    grid-area: corner;
    background: var(--sl-color-bg-nav, var(--sl-color-bg));
    border-block-end: 1px solid var(--sl-color-gray-5);
  }
  .ruler line {
    stroke: var(--sl-color-gray-3);
    stroke-width: 1;
  }
  .ruler text {
    fill: var(--sl-color-gray-2);
    font-size: 9px;
    font-family: var(--__sl-font-mono, monospace);
  }
  .stage {
    grid-area: stage;
    position: relative;
    min-width: 0;
    min-height: 0;
    touch-action: none;
    outline: none;
    /* The canvas is always laid out left to right, also in RTL locales. */
    direction: ltr;
  }
  .surface {
    position: absolute;
    inset: 0;
    display: block;
    cursor: grab;
    user-select: none;
  }
  .grid-line {
    fill: none;
    stroke: var(--sl-color-gray-5);
  }
  .grid-line.major {
    stroke: var(--sl-color-gray-4);
  }
  .grid-fill {
    pointer-events: none;
  }
  .axis {
    stroke: var(--sl-color-accent);
    opacity: 0.4;
    pointer-events: none;
  }
  .item {
    cursor: move;
    outline: none;
  }
  .item.locked {
    cursor: default;
  }
  .hit {
    fill: transparent;
  }
  .item:focus-visible .hit {
    stroke: var(--sl-color-accent-high, var(--sl-color-accent));
    stroke-dasharray: 2 1;
    stroke-width: 0.5;
  }
  .selection {
    fill: none;
    stroke: var(--sl-color-accent);
  }
  .guide {
    stroke: #ed2024;
  }
  .design-grid {
    stroke: var(--sl-color-accent);
    opacity: 0.25;
  }
  .design-grid.edge {
    opacity: 0.6;
  }
  .keylines {
    fill: none;
    stroke: #278e43;
    opacity: 0.7;
  }
  .pixels {
    image-rendering: pixelated;
    opacity: 0.85;
  }
  .empty {
    position: absolute;
    inset: auto 1rem 1rem;
    margin: 0;
    text-align: center;
    color: var(--sl-color-gray-2);
    pointer-events: none;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
