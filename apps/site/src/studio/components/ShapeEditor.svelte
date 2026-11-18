<script lang="ts">
  import { listShapes, renderShapeData, type Primitive, type Vec } from "@0xdolan/deq-core";
  import { onMount } from "svelte";

  import { BOOL_OPS, type BoolOp } from "../boolean.ts";
  import { CustomShapeError, flatten, toShapeData, toSpecJson, type CustomDef } from "../custom.ts";
  import { downloadText } from "../db.ts";
  import { PART_KINDS, ShapeDraft, newPart, type DraftState, type EditError } from "../editor.svelte.ts";
  import { hitTest, samplePolylines } from "../geometry.ts";
  import type { StudioKey, Translate } from "../i18n.ts";
  import {
    deletePoint,
    editPath,
    insertPoint,
    primitivePoints,
    setPrimitivePoint,
    toggleClosed,
    toggleCurve,
    type PointRef,
  } from "../pathedit.ts";
  import type { Studio } from "../store.svelte.ts";
  import { svgMarkup } from "../svg.ts";

  interface Props {
    studio: Studio;
    t: Translate;
    locale: "en" | "ckb" | "kmr";
    /** The shape to edit, or undefined for a new one. */
    def?: CustomDef | undefined;
    onclose: () => void;
  }
  let { studio, t, locale, def, onclose }: Props = $props();

  // The parent re-creates this component for every shape it opens.
  // svelte-ignore state_referenced_locally
  const draft = new ShapeDraft(def);
  const catalog = listShapes().filter((s) => s.category !== "brand");
  const nameOf = (s: (typeof catalog)[number]): string =>
    (locale === "en" ? null : s.names[locale].text) ?? s.names.en;
  const GRID = Array.from({ length: 25 }, (_, i) => i);
  const PAINTED = new Set(["line", "polyline", "polygon", "path", "circle", "ellipse", "arc", "rect", "star"]);
  const VECTORS = ["center", "step", "spread"] as const;

  let root: HTMLElement | undefined = $state();
  let overlay: SVGSVGElement | undefined = $state();
  let message = $state("");
  /** The selected point of the current part (path editing). */
  let point = $state<PointRef | undefined>();
  let drag:
    | { kind: "move"; before: DraftState; start: Vec }
    | { kind: "point"; before: DraftState; part: number; ref: PointRef }
    | undefined;

  const partLabel = (p: Primitive): string => t(`studio.part.${p.type}` as StudioKey);
  const index = $derived(draft.selected.length === 1 ? draft.selected[0] : undefined);
  const current = $derived(draft.current);
  const points = $derived(current ? primitivePoints(current) : []);
  const isPath = $derived(current?.type === "path");
  const canUnwrap = $derived(current?.type === "radial" || current?.type === "repeat" || current?.type === "concentric");

  let lastGood = "";
  const preview = $derived.by(() => {
    if (draft.primitives.length === 0) return "";
    try {
      const shape = toShapeData({ id: draft.id, version: 1, name: "draft", primitives: draft.primitives });
      lastGood = renderShapeData(shape, { title: "", size: 240 });
    } catch {
      // Mid-drag the parts can be briefly invalid: keep showing the last good picture.
    }
    return lastGood;
  });
  const outlines = $derived(
    draft.selected.flatMap((i) => {
      const prim = draft.primitives[i];
      if (!prim) return [];
      try {
        return flatten([prim]).flatMap((f) => samplePolylines(f).map((line) => line.map((p) => p.join(",")).join(" ")));
      } catch {
        return [];
      }
    }),
  );

  onMount(() => {
    root?.focus();
  });

  function show(error: EditError | undefined): void {
    message = error ? t(`studio.shape.error.${error}` as StudioKey) : "";
  }
  function edit(fn: () => EditError | undefined): void {
    show(fn());
  }

  // Pointer editing ----------------------------------------------------------------------

  const snap = (n: number): number => Math.min(24, Math.max(0, Math.round(n * 2) / 2));
  function toGrid(e: PointerEvent): Vec | undefined {
    const ctm = overlay?.getScreenCTM();
    if (!ctm) return undefined;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }

  function down(e: PointerEvent): void {
    if (e.button !== 0) return;
    const p = toGrid(e);
    if (!p) return;
    const handle = (e.target as Element).closest<SVGElement>("[data-k]");
    if (handle && index !== undefined) {
      const ref: PointRef = { i: Number(handle.dataset["i"]), k: handle.dataset["k"] as PointRef["k"] };
      point = ref;
      drag = { kind: "point", before: draft.state, part: index, ref };
    } else {
      const hit = hitTest(draft.primitives, p, e.pointerType === "touch" ? 1 : 0.6);
      if (hit < 0) {
        if (!e.shiftKey) draft.deselect();
        point = undefined;
        return;
      }
      if (e.shiftKey || !draft.selection.includes(hit)) {
        draft.select(hit, e.shiftKey);
        point = undefined;
      }
      if (draft.selection.length === 0) return;
      drag = { kind: "move", before: draft.state, start: p };
    }
    overlay?.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function move(e: PointerEvent): void {
    if (!drag) return;
    const p = toGrid(e);
    if (!p) return;
    if (drag.kind === "move") {
      const dx = Math.round((p[0] - drag.start[0]) * 2) / 2;
      const dy = Math.round((p[1] - drag.start[1]) * 2) / 2;
      draft.previewMove(drag.before, dx, dy);
    } else {
      const { part, ref, before } = drag;
      const target: Vec = [snap(p[0]), snap(p[1])];
      draft.preview(before.primitives.map((prim, i) => (i === part ? setPrimitivePoint(prim, ref, target) : prim)));
    }
  }

  function up(): void {
    if (!drag) return;
    const label = drag.kind === "move" ? t("studio.act.move") : t("studio.shape.data");
    show(draft.commitPreview(drag.before, label));
    drag = undefined;
  }

  // Tools --------------------------------------------------------------------------------

  function pathEdit(fn: Parameters<typeof editPath>[1], label: string): void {
    if (!current || index === undefined) return;
    const next = editPath(current, fn);
    if (!next) {
      show("invalid");
      return;
    }
    const i = index;
    edit(() => draft.update(i, next, label));
  }

  async function boolean(op: BoolOp): Promise<void> {
    show(await draft.boolean(op, t(`studio.bool.${op}`)));
  }

  function undo(): void {
    const label = draft.undo();
    if (label) studio.announce(t("studio.undone", { label }));
    point = undefined;
  }
  function redo(): void {
    const label = draft.redo();
    if (label) studio.announce(t("studio.redone", { label }));
    point = undefined;
  }

  function addCatalog(e: Event): void {
    const select = e.currentTarget as HTMLSelectElement;
    const shape = select.value;
    select.value = "";
    if (shape) edit(() => draft.add({ type: "use", shape }, t("studio.shape.addCatalog")));
  }

  // Inspector ----------------------------------------------------------------------------

  function setField(key: string, value: unknown): void {
    if (!current || index === undefined) return;
    const i = index;
    const next = { ...current, [key]: value } as Primitive;
    edit(() => draft.update(i, next, t("studio.shape.properties")));
  }
  function numberOf(e: Event): number | undefined {
    const n = (e.currentTarget as HTMLInputElement).valueAsNumber;
    return Number.isFinite(n) ? n : undefined;
  }
  function setNumber(key: string, e: Event): void {
    const n = numberOf(e);
    if (n === undefined) show("invalid");
    else setField(key, n);
  }
  function setVector(key: string, axis: 0 | 1, e: Event): void {
    const n = numberOf(e);
    const old = current?.[key as keyof Primitive] as unknown as Vec | undefined;
    if (n === undefined) show("invalid");
    else setField(key, axis === 0 ? [n, old?.[1] ?? 0] : [old?.[0] ?? 0, n]);
  }
  function setTransform(key: "scale" | "rotate" | "tx" | "ty", e: Event): void {
    if (current?.type !== "use") return;
    const n = numberOf(e);
    if (n === undefined) {
      show("invalid");
      return;
    }
    const old = current.transform ?? {};
    const translate: Vec = [key === "tx" ? n : (old.translate?.[0] ?? 0), key === "ty" ? n : (old.translate?.[1] ?? 0)];
    const next = {
      ...old,
      ...(key === "scale" ? { scale: n } : {}),
      ...(key === "rotate" ? { rotate: n } : {}),
      ...(key === "tx" || key === "ty" ? { translate } : {}),
    };
    setField("transform", next);
  }
  function numbers(p: Primitive): [string, number][] {
    return Object.entries(p).filter((e): e is [string, number] => typeof e[1] === "number");
  }
  function vectors(p: Primitive): [string, Vec][] {
    return VECTORS.flatMap((k) => {
      const v = (p as unknown as Record<string, unknown>)[k];
      return Array.isArray(v) ? [[k, v as unknown as Vec] as [string, Vec]] : [];
    });
  }

  // Save, cancel, export -----------------------------------------------------------------

  function finished(): CustomDef | undefined {
    try {
      return draft.toDef(t("studio.shape.untitled"));
    } catch (error) {
      message = error instanceof CustomShapeError && draft.primitives.length === 0 ? t("studio.shape.noParts") : (error as Error).message;
      return undefined;
    }
  }
  async function save(): Promise<void> {
    const out = finished();
    if (!out) return;
    try {
      await studio.saveCustom(out, t("studio.shape.saved", { name: out.name }));
    } catch (error) {
      message = (error as Error).message;
      return;
    }
    studio.announce(t("studio.shape.saved", { name: out.name }));
    onclose();
  }
  function cancel(): void {
    if (draft.dirty && !confirm(t("studio.shape.discard"))) return;
    onclose();
  }
  function exportJson(): void {
    const out = finished();
    if (out) downloadText(`${out.id}.json`, toSpecJson(out));
  }

  function keydown(e: KeyboardEvent): void {
    e.stopPropagation();
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select")) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const step = e.shiftKey ? 2 : 0.5;
    const nudge = (dx: number, dy: number) => {
      edit(() => draft.move(dx, dy, t("studio.act.move"), "nudge"));
    };
    if (mod && key === "z") {
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && key === "y") redo();
    else if (mod && key === "a") draft.selectAll();
    else if (mod && key === "d") edit(() => draft.duplicate(t("studio.act.duplicate")));
    else if (!mod && (key === "delete" || key === "backspace")) edit(() => draft.remove(t("studio.act.delete")));
    else if (!mod && key === "arrowleft") nudge(-step, 0);
    else if (!mod && key === "arrowright") nudge(step, 0);
    else if (!mod && key === "arrowup") nudge(0, -step);
    else if (!mod && key === "arrowdown") nudge(0, step);
    else if (key === "escape") {
      if (draft.selection.length > 0) draft.deselect();
      else cancel();
    } else return;
    e.preventDefault();
  }
</script>

<div
  class="editor"
  role="dialog"
  aria-modal="true"
  aria-labelledby="studio-shape-h"
  tabindex="-1"
  bind:this={root}
  onkeydown={keydown}
>
  <header class="head">
    <h2 id="studio-shape-h">{draft.isNew ? t("studio.shape.new") : t("studio.shape.editTitle")}</h2>
    <label class="name">
      <span>{t("studio.shape.name")}</span>
      <input
        type="text"
        value={draft.state.name}
        maxlength="80"
        placeholder={t("studio.shape.untitled")}
        oninput={(e) => draft.setName(e.currentTarget.value, t("studio.shape.name"))}
      />
    </label>
    <div class="actions">
      <button type="button" onclick={exportJson}>{t("studio.shape.exportJson")}</button>
      <button type="button" onclick={cancel}>{t("studio.shape.cancel")}</button>
      <button type="button" class="primary" onclick={save}>{t("studio.shape.save")}</button>
    </div>
  </header>

  <div class="tools" role="toolbar" aria-label={t("studio.shape.tools")}>
    <div class="group" role="group" aria-label={t("studio.shape.addPart")}>
      {#each PART_KINDS as kind (kind)}
        <button type="button" data-part={kind} onclick={() => edit(() => draft.add(newPart(kind), t("studio.shape.addPart")))}>
          {t(`studio.part.${kind}` as StudioKey)}
        </button>
      {/each}
      <select aria-label={t("studio.shape.addCatalog")} onchange={addCatalog}>
        <option value="">{t("studio.shape.addCatalog")}</option>
        {#each catalog as s (s.id)}
          <option value={s.id}>{nameOf(s)}</option>
        {/each}
      </select>
    </div>
    <div class="group" role="group" aria-label={t("studio.shape.parts")}>
      <button type="button" onclick={undo} disabled={!draft.canUndo}>{t("studio.action.undo")}</button>
      <button type="button" onclick={redo} disabled={!draft.canRedo}>{t("studio.action.redo")}</button>
      {#each [
        ["studio.action.delete", () => draft.remove(t("studio.act.delete"))],
        ["studio.action.duplicate", () => draft.duplicate(t("studio.act.duplicate"))],
        ["studio.tool.up", () => draft.reorder("up", t("studio.tool.up"))],
        ["studio.tool.down", () => draft.reorder("down", t("studio.tool.down"))],
        ["studio.tool.flipH", () => draft.mirror("x", false, t("studio.tool.flipH"))],
        ["studio.tool.flipV", () => draft.mirror("y", false, t("studio.tool.flipV"))],
        ["studio.tool.mirrorH", () => draft.mirror("x", true, t("studio.tool.mirrorH"))],
        ["studio.tool.mirrorV", () => draft.mirror("y", true, t("studio.tool.mirrorV"))],
        ["studio.tool.rotateLeft", () => draft.rotate(-45, t("studio.tool.rotateLeft"))],
        ["studio.tool.rotateRight", () => draft.rotate(45, t("studio.tool.rotateRight"))],
        ["studio.tool.grow", () => draft.scale(1.25, t("studio.tool.grow"))],
        ["studio.tool.shrink", () => draft.scale(0.8, t("studio.tool.shrink"))],
        ["studio.tool.radial", () => draft.wrap("radial", t("studio.tool.radial"))],
        ["studio.tool.repeat", () => draft.wrap("repeat", t("studio.tool.repeat"))],
        ["studio.tool.toPath", () => draft.toPath(t("studio.tool.toPath"))],
      ] as const as [key, run] (key)}
        <button type="button" data-tool={key.split(".").at(-1)} disabled={draft.selection.length === 0} onclick={() => edit(run)}>{t(key)}</button>
      {/each}
      <button type="button" data-tool="unwrap" disabled={!canUnwrap} onclick={() => edit(() => draft.unwrap(t("studio.tool.unwrap")))}>{t("studio.tool.unwrap")}</button>
    </div>
    <div class="group" role="group" aria-label={t("studio.bool.unite")}>
      {#each BOOL_OPS as op (op)}
        <button type="button" data-bool={op} disabled={draft.selection.length < 2} onclick={() => boolean(op)}>{t(`studio.bool.${op}`)}</button>
      {/each}
    </div>
    {#if isPath}
      <div class="group" role="group" aria-label={t("studio.shape.data")}>
        <button type="button" data-tool="addPoint" disabled={!point} onclick={() => point && pathEdit((s) => insertPoint(s, point?.i ?? 0), t("studio.tool.addPoint"))}>{t("studio.tool.addPoint")}</button>
        <button
          type="button"
          data-tool="deletePoint"
          disabled={!point}
          onclick={() => {
            const i = point?.i ?? 0;
            point = undefined;
            pathEdit((s) => deletePoint(s, i), t("studio.tool.deletePoint"));
          }}>{t("studio.tool.deletePoint")}</button
        >
        <button type="button" data-tool="curve" disabled={!point} onclick={() => pathEdit((s) => toggleCurve(s, point?.i ?? 0), t("studio.tool.curve"))}>{t("studio.tool.curve")}</button>
        <button type="button" data-tool="close" onclick={() => pathEdit(toggleClosed, t("studio.tool.close"))}>{t("studio.tool.close")}</button>
      </div>
    {/if}
  </div>
  <p class="note" role="status">{message}</p>

  <div class="body">
    <div class="stage">
      <svg class="grid" viewBox="-0.5 -0.5 25 25" aria-hidden="true">
        {#each GRID as n (n)}
          <line x1={n} y1="0" x2={n} y2="24" class:major={n % 6 === 0} />
          <line x1="0" y1={n} x2="24" y2={n} class:major={n % 6 === 0} />
        {/each}
      </svg>
      <div class="render" aria-hidden="true" use:svgMarkup={preview}></div>
      <svg
        bind:this={overlay}
        class="overlay"
        viewBox="-0.5 -0.5 25 25"
        role="img"
        aria-label={t("studio.shape.canvas")}
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
      >
        {#each outlines as line, n (n)}
          <polyline points={line} class="outline" />
        {/each}
        {#each points as pt (`${String(pt.i)}${pt.k}`)}
          {#if pt.anchor}
            <line x1={pt.anchor[0]} y1={pt.anchor[1]} x2={pt.p[0]} y2={pt.p[1]} class="arm" />
            <circle cx={pt.p[0]} cy={pt.p[1]} r="0.35" class="handle" class:on={point?.i === pt.i && point.k === pt.k} data-i={pt.i} data-k={pt.k} />
          {:else}
            <rect x={pt.p[0] - 0.35} y={pt.p[1] - 0.35} width="0.7" height="0.7" class="handle" class:on={point?.i === pt.i && point.k === pt.k} data-i={pt.i} data-k={pt.k} />
          {/if}
        {/each}
      </svg>
    </div>

    <div class="side">
      <section aria-labelledby="studio-parts-h">
        <h3 id="studio-parts-h">{t("studio.shape.parts")}</h3>
        {#if draft.primitives.length === 0}
          <p class="empty">{t("studio.shape.noParts")}</p>
        {:else}
          <ol class="parts" reversed>
            {#each draft.primitives.map((p, i) => [p, i] as const).reverse() as [p, i] (i)}
              <li>
                <button
                  type="button"
                  data-index={i}
                  aria-pressed={draft.selection.includes(i)}
                  onclick={(e) => {
                    draft.select(i, e.shiftKey || e.ctrlKey || e.metaKey);
                    point = undefined;
                  }}>{partLabel(p)}</button
                >
              </li>
            {/each}
          </ol>
        {/if}
      </section>

      {#if current && index !== undefined}
        <section class="props" aria-labelledby="studio-props-h">
          <h3 id="studio-props-h">{t("studio.shape.properties")} · {partLabel(current)}</h3>
          {#if current.type === "use"}
            <label class="field">
              <span>{t("studio.shape.catalog")}</span>
              <select value={current.shape} onchange={(e) => setField("shape", e.currentTarget.value)}>
                {#each catalog as s (s.id)}
                  <option value={s.id}>{nameOf(s)}</option>
                {/each}
              </select>
            </label>
            {#each [["scale", current.transform?.scale ?? 1, 0.05], ["rotate", current.transform?.rotate ?? 0, 15], ["tx", current.transform?.translate?.[0] ?? 0, 0.5], ["ty", current.transform?.translate?.[1] ?? 0, 0.5]] as const as [key, value, step] (key)}
              <label class="field num">
                <code>{key}</code>
                <input type="number" {step} {value} onchange={(e) => setTransform(key, e)} />
              </label>
            {/each}
          {:else}
            {#each numbers(current) as [key, value] (key)}
              <label class="field num">
                <code>{key}</code>
                <input type="number" step={key === "count" || key === "points" ? 1 : 0.5} {value} data-field={key} onchange={(e) => setNumber(key, e)} />
              </label>
            {/each}
            {#each vectors(current) as [key, value] (key)}
              {#each [0, 1] as const as axis (axis)}
                <label class="field num">
                  <code>{key}.{axis === 0 ? "x" : "y"}</code>
                  <input type="number" step="0.5" value={value[axis]} onchange={(e) => setVector(key, axis, e)} />
                </label>
              {/each}
            {/each}
            {#if current.type === "path"}
              <label class="field">
                <span>{t("studio.shape.data")}</span>
                <textarea rows="3" spellcheck="false" value={current.d} onchange={(e) => setField("d", e.currentTarget.value.trim())}></textarea>
              </label>
            {/if}
            {#if PAINTED.has(current.type)}
              <label class="field">
                <span>{t("studio.shape.paint")}</span>
                <select value={"paint" in current ? (current.paint ?? "stroke") : "stroke"} onchange={(e) => setField("paint", e.currentTarget.value)}>
                  <option value="stroke">{t("studio.paint.stroke")}</option>
                  <option value="fill">{t("studio.paint.fill")}</option>
                </select>
              </label>
            {/if}
            {#if "element" in current}
              <p class="hint">{t("studio.shape.element", { type: partLabel(current.element) })}</p>
            {/if}
          {/if}
        </section>
      {/if}
    </div>
  </div>
</div>

<style>
  .editor {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr);
    background: var(--sl-color-bg);
    overflow: auto;
  }
  .editor:focus {
    outline: none;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.5rem 1rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--sl-color-gray-5);
  }
  h2 {
    margin: 0;
    font-size: var(--sl-text-lg);
  }
  h3 {
    margin: 0 0 0.375rem;
    font-size: var(--sl-text-sm);
  }
  .name {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex: 1 1 12rem;
  }
  .name input {
    flex: 1;
    min-width: 0;
  }
  .actions {
    display: flex;
    gap: 0.375rem;
    margin-inline-start: auto;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem 0;
  }
  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding-inline-end: 0.5rem;
    border-inline-end: 1px solid var(--sl-color-gray-5);
  }
  button,
  select,
  input,
  textarea {
    font: inherit;
    font-size: var(--sl-text-xs);
  }
  button {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.375rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-white);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button[aria-pressed="true"],
  .primary {
    background: var(--sl-color-accent);
    border-color: var(--sl-color-accent);
    color: var(--sl-color-black);
  }
  button:focus-visible {
    outline: 2px solid var(--sl-color-accent);
    outline-offset: 2px;
  }
  .note {
    min-height: 1.25rem;
    margin: 0.25rem 0.75rem;
    font-size: var(--sl-text-xs);
    color: var(--sl-color-orange-high, var(--sl-color-white));
  }
  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 18rem;
    gap: 0.75rem;
    padding: 0 0.75rem 0.75rem;
    min-height: 0;
  }
  .stage {
    position: relative;
    aspect-ratio: 1;
    max-height: 100%;
    max-width: 100%;
    justify-self: center;
    height: min(100%, 36rem);
    min-height: 16rem;
  }
  .stage > * {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .grid line {
    stroke: var(--sl-color-gray-5);
    stroke-width: 0.03;
  }
  .grid line.major {
    stroke: var(--sl-color-gray-4);
    stroke-width: 0.06;
  }
  .render {
    padding: calc(100% * 0.5 / 25);
    box-sizing: border-box;
    color: var(--sl-color-white);
    pointer-events: none;
  }
  .render :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .overlay {
    touch-action: none;
    cursor: crosshair;
  }
  .outline {
    fill: none;
    stroke: var(--sl-color-accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 4 3;
  }
  .arm {
    stroke: var(--sl-color-accent);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
  .handle {
    fill: var(--sl-color-bg);
    stroke: var(--sl-color-accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
    cursor: move;
  }
  .handle.on {
    fill: var(--sl-color-accent);
  }
  .side {
    display: grid;
    align-content: start;
    gap: 0.75rem;
    min-height: 0;
    overflow-y: auto;
  }
  .parts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  .parts li {
    margin: 0;
  }
  .parts button {
    width: 100%;
    text-align: start;
  }
  .props {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.375rem 0.5rem;
  }
  .props h3,
  .props .hint,
  .props .field:not(.num) {
    grid-column: 1 / -1;
  }
  .field {
    display: grid;
    gap: 0.125rem;
    font-size: var(--sl-text-xs);
  }
  .field input,
  .field select,
  .field textarea {
    width: 100%;
    min-width: 0;
  }
  .empty,
  .hint {
    margin: 0;
    font-size: var(--sl-text-xs);
    color: var(--sl-color-gray-3);
  }
  @media (max-width: 50rem) {
    .editor {
      grid-template-rows: auto;
    }
    .body {
      grid-template-columns: minmax(0, 1fr);
    }
    .stage {
      /* Explicit size: a percentage width with aspect-ratio leaves the grid row too short. */
      width: min(calc(100vw - 1.5rem), 60vh);
      height: min(calc(100vw - 1.5rem), 60vh);
      max-height: none;
      min-height: 0;
    }
    .side {
      overflow-y: visible;
    }
  }
</style>
