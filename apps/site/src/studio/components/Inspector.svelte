<script lang="ts">
  import { DEFAULT_OPTIONS, getShape, type ParameterDecl } from "@0xdolan/deq-core";

  import type { StudioKey, Translate } from "../i18n.ts";
  import { ALIGN_EDGES } from "../arrange.ts";
  import { itemBox, OPTION_KEYS, optionValue, renderOptions, type Item, type OptionKey } from "../model.ts";
  import { renderCached } from "../render.ts";
  import type { Action } from "../shortcuts.ts";
  import { unionBox } from "../snap.ts";
  import type { Studio } from "../store.svelte.ts";
  import { svgMarkup } from "../svg.ts";

  interface Props {
    studio: Studio;
    t: Translate;
    run: (action: Action) => void;
  }
  let { studio, t, run }: Props = $props();

  const PREVIEW_SIZES = [16, 24, 32, 48, 96] as const;

  type Control =
    | { type: "number"; min: number; max: number; step: number; slider?: { min: number; max: number } }
    | { type: "boolean" }
    | { type: "enum"; values: readonly string[] }
    | { type: "color"; none: boolean };

  const CONTROLS: Record<OptionKey, Control> = {
    size: { type: "number", min: 1, max: 8192, step: 1, slider: { min: 8, max: 256 } },
    color: { type: "color", none: false },
    strokeWidth: { type: "number", min: 0.05, max: 12, step: 0.05, slider: { min: 0.25, max: 6 } },
    absoluteStrokeWidth: { type: "boolean" },
    fill: { type: "color", none: true },
    fillOpacity: { type: "number", min: 0, max: 1, step: 0.05, slider: { min: 0, max: 1 } },
    strokeOpacity: { type: "number", min: 0, max: 1, step: 0.05, slider: { min: 0, max: 1 } },
    linecap: { type: "enum", values: ["round", "butt", "square"] },
    linejoin: { type: "enum", values: ["round", "miter", "bevel"] },
    dotScale: { type: "number", min: 0.1, max: 4, step: 0.05, slider: { min: 0.1, max: 4 } },
    rotation: { type: "number", min: -3600, max: 3600, step: 1, slider: { min: -180, max: 180 } },
    flipX: { type: "boolean" },
    flipY: { type: "boolean" },
    padding: { type: "number", min: 0, max: 24, step: 0.5, slider: { min: 0, max: 12 } },
    background: { type: "color", none: true },
  };

  const ALIGN_ACTIONS = {
    left: "alignLeft", hcenter: "alignHCenter", right: "alignRight",
    top: "alignTop", vcenter: "alignVCenter", bottom: "alignBottom",
  } as const;
  const ORDER_ACTIONS = ["bringToFront", "bringForward", "sendBackward", "sendToBack"] as const;

  /** The selected items; batch edits apply to all of them. */
  const sel = $derived(studio.selected);
  const ids = $derived(sel.map((i) => i.id));
  const item = $derived(sel[0]);
  const single = $derived(sel.length === 1);
  /** Parameters and layer colours only show when every selected item is the same shape. */
  const shape = $derived(item && sel.every((i) => i.shape === item.shape) ? getShape(item.shape) : undefined);
  const box = $derived(unionBox(sel.map(itemBox)));
  const units = $derived(studio.units);
  let errors = $state<Record<string, string>>({});
  const key = $derived(ids.join(","));

  // Clear stale errors when the selection changes.
  $effect(() => {
    void key;
    errors = {};
  });

  /** The shared value of `get` over the selection, or `mixed`. */
  function common<T>(get: (it: Item) => T): { value: T; mixed: boolean } {
    const values = sel.map(get);
    const [first] = values;
    return { value: first as T, mixed: values.some((v) => v !== first) };
  }

  /** Show a checkbox as neither on nor off when the selection disagrees. */
  function indeterminate(node: HTMLInputElement, on: boolean): { update: (on: boolean) => void } {
    node.indeterminate = on;
    return {
      update(next: boolean) {
        node.indeterminate = next;
      },
    };
  }

  const optLabel = (key: OptionKey) => t(`studio.opt.${key}` as StudioKey);
  const valLabel = (v: string) => t(`studio.val.${v}` as StudioKey);
  const HEX6 = /^#[0-9a-f]{6}$/iu;

  function setError(key: string, message: string | undefined): void {
    const rest = Object.fromEntries(Object.entries(errors).filter(([k]) => k !== key));
    errors = message ? { ...rest, [key]: message } : rest;
  }

  function setOption(key: OptionKey, value: unknown): void {
    const message = studio.setOptions(
      ids,
      { [key]: value },
      t("studio.act.edit", { option: optLabel(key) }),
      `opt:${ids.join(",")}:${key}`,
    );
    setError(key, message);
  }

  function numberInput(key: OptionKey, raw: string): void {
    if (raw.trim() === "") return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setOption(key, n);
  }

  function colorText(key: OptionKey, raw: string, mixed: boolean): void {
    const value = raw.trim();
    if (value === "") {
      // An empty field over mixed values leaves them alone.
      if (!mixed) studio.resetOption(ids, key, t("studio.act.reset"));
      setError(key, undefined);
      return;
    }
    setOption(key, value);
  }

  function reset(key: OptionKey): void {
    studio.resetOption(ids, key, t("studio.act.reset"));
    setError(key, undefined);
  }

  function moveTo(axis: "x" | "y", raw: string): void {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n) || !box) return;
    const d = n - (axis === "x" ? box.x : box.y);
    studio.moveBy(ids, axis === "x" ? d : 0, axis === "y" ? d : 0, t("studio.act.move"));
  }

  function display(value: unknown): string {
    if (typeof value === "boolean") return valLabel(value ? "on" : "off");
    if (typeof value === "string" && ["round", "butt", "square", "miter", "bevel", "none"].includes(value))
      return valLabel(value);
    return String(value);
  }

  function paramValue(it: Item, name: string, decl: ParameterDecl): number | boolean | string {
    const v = it.options.params?.[name];
    return v === undefined ? decl.default : v;
  }

  function setParam(name: string, value: number | boolean | string): void {
    setError(`param:${name}`, studio.setParam(ids, name, value, t("studio.act.edit", { option: name })));
  }

  function setLayer(layer: string, raw: string): void {
    const value = raw.trim();
    setError(
      `layer:${layer}`,
      studio.setLayerColor(ids, layer, value === "" ? undefined : value, t("studio.act.edit", { option: layer })),
    );
  }

  function previewMarkup(it: Item, size: number): string {
    try {
      return renderCached(it.shape, renderOptions(it, { size, title: "" }));
    } catch {
      return "";
    }
  }
</script>

<section class="inspector" aria-labelledby="studio-inspector-h">
  <h2 id="studio-inspector-h" class="panel-title">{t("studio.inspector")}</h2>
  {#if !item}
    <p class="hint">{t("studio.nothingSelected")}</p>
  {:else}
    {@const it = item}
    <div class="body">
      {#if !single}
        <p class="hint count" role="status">{t("studio.multiSelected", { count: sel.length })}</p>
      {/if}
      <div class="actions">
        <button type="button" onclick={() => run("duplicate")}>{t("studio.duplicate")}</button>
        <button type="button" onclick={() => run("delete")} disabled={sel.every((i) => i.locked)}>{t("studio.delete")}</button>
        <button type="button" data-action="reset-shape" onclick={() => { studio.resetItems(ids, t("studio.act.reset")); errors = {}; }}>{t("studio.resetShape")}</button>
        <button type="button" data-action="reset-all" onclick={() => { studio.resetItems(studio.doc.items.map((i) => i.id), t("studio.act.reset")); errors = {}; }}>{t("studio.resetAll")}</button>
      </div>

      {#if single}
        <fieldset>
          <legend>{t("studio.preview")}</legend>
          <ul class="previews" role="list">
            {#each PREVIEW_SIZES as size (size)}
              <li>
                <span class="preview" style:width={`${String(size)}px`} style:height={`${String(size)}px`} aria-hidden="true" use:svgMarkup={previewMarkup(it, size)}></span>
                <span class="size">{t("studio.previewSize", { size })}</span>
              </li>
            {/each}
          </ul>
        </fieldset>

        <label class="field">
          <span>{t("studio.name")}</span>
          <input
            type="text"
            maxlength="80"
            value={it.name ?? ""}
            placeholder={getShape(it.shape).names.en}
            oninput={(e) => studio.setName(it.id, e.currentTarget.value, t("studio.act.rename"))}
          />
        </label>
      {/if}

      {#if box}
        <fieldset class="pair">
          <legend>{t("studio.position")}</legend>
          <label class="field">
            <span>{t("studio.x")}</span>
            <input type="number" step="1" value={box.x} onchange={(e) => moveTo("x", e.currentTarget.value)} />
          </label>
          <label class="field">
            <span>{t("studio.y")}</span>
            <input type="number" step="1" value={box.y} onchange={(e) => moveTo("y", e.currentTarget.value)} />
          </label>
        </fieldset>
      {/if}

      <fieldset class="arrange" data-section="arrange">
        <legend>{t("studio.arrange")}</legend>
        <div class="tools" role="group" aria-label={t("studio.align")}>
          {#each ALIGN_EDGES as edge (edge)}
            {@const action = ALIGN_ACTIONS[edge]}
            <button type="button" data-action={action} disabled={units < 2} onclick={() => run(action)}>{t(`studio.action.${action}`)}</button>
          {/each}
        </div>
        <div class="tools" role="group" aria-label={t("studio.distribute")}>
          {#each ["distributeH", "distributeV"] as const as action (action)}
            <button type="button" data-action={action} disabled={units < 3} onclick={() => run(action)}>{t(`studio.action.${action}`)}</button>
          {/each}
        </div>
        <div class="tools" role="group" aria-label={t("studio.order")}>
          {#each ORDER_ACTIONS as action (action)}
            <button type="button" data-action={action} onclick={() => run(action)}>{t(`studio.action.${action}`)}</button>
          {/each}
        </div>
        <div class="tools">
          <button type="button" data-action="group" disabled={units < 2} onclick={() => run("group")}>{t("studio.action.group")}</button>
          <button type="button" data-action="ungroup" disabled={!sel.some((i) => i.group)} onclick={() => run("ungroup")}>{t("studio.action.ungroup")}</button>
          <button type="button" data-action="toggleLock" aria-pressed={sel.every((i) => i.locked)} onclick={() => run("toggleLock")}>{t("studio.action.toggleLock")}</button>
          <button type="button" data-action="toggleHide" aria-pressed={sel.every((i) => i.hidden)} onclick={() => run("toggleHide")}>{t("studio.action.toggleHide")}</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>{t("studio.options")}</legend>
        {#each OPTION_KEYS as key (key)}
          {@const c = CONTROLS[key]}
          {@const { value, mixed } = common((i) => optionValue(i, key))}
          {@const changed = sel.some((i) => key in i.options)}
          {@const id = `studio-opt-${key}`}
          <div class="row" class:changed class:mixed data-option={key}>
            {#if c.type === "boolean"}
              <label class="check" for={id}>
                <input {id} type="checkbox" checked={!mixed && Boolean(value)} use:indeterminate={mixed} onchange={(e) => setOption(key, e.currentTarget.checked)} />
                <span>{optLabel(key)}</span>
              </label>
            {:else}
              <label for={id}>{optLabel(key)}</label>
              <div class="control">
                {#if c.type === "number"}
                  {#if c.slider}
                    <input type="range" aria-label={optLabel(key)} min={c.slider.min} max={c.slider.max} step={c.step} value={Number(value)} oninput={(e) => numberInput(key, e.currentTarget.value)} />
                  {/if}
                  <input {id} class="num" type="number" min={c.min} max={c.max} step={c.step} value={mixed ? "" : Number(value)} placeholder={mixed ? t("studio.mixed") : undefined} oninput={(e) => numberInput(key, e.currentTarget.value)} aria-describedby={errors[key] ? `${id}-err` : undefined} />
                {:else if c.type === "enum"}
                  <select {id} value={mixed ? "" : String(value)} onchange={(e) => setOption(key, e.currentTarget.value)}>
                    {#if mixed}
                      <option value="" disabled>{t("studio.mixed")}</option>
                    {/if}
                    {#each c.values as v (v)}
                      <option value={v}>{valLabel(v)}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    type="color"
                    aria-label={`${optLabel(key)}: ${t("studio.useColor")}`}
                    value={!mixed && HEX6.test(String(value)) ? String(value) : "#000000"}
                    oninput={(e) => setOption(key, e.currentTarget.value)}
                  />
                  <input
                    {id}
                    class="text"
                    type="text"
                    dir="ltr"
                    spellcheck="false"
                    autocomplete="off"
                    value={changed && !mixed ? String(value) : ""}
                    placeholder={mixed ? t("studio.mixed") : String(DEFAULT_OPTIONS[key])}
                    onchange={(e) => colorText(key, e.currentTarget.value, mixed)}
                    aria-describedby={errors[key] ? `${id}-err` : undefined}
                    aria-invalid={errors[key] ? "true" : undefined}
                  />
                {/if}
              </div>
            {/if}
            <button
              type="button"
              class="reset"
              disabled={!changed}
              aria-label={t("studio.resetOption", { option: optLabel(key) })}
              title={t("studio.default", { value: display(DEFAULT_OPTIONS[key]) })}
              onclick={() => reset(key)}>↺</button>
            {#if errors[key]}
              <p class="error" id={`${id}-err`} role="alert">{errors[key]}</p>
            {/if}
          </div>
        {/each}
      </fieldset>

      {#if shape && Object.keys(shape.parameters).length > 0}
        <fieldset>
          <legend>{t("studio.params")}</legend>
          {#each Object.entries(shape.parameters) as [name, decl] (name)}
            {@const { value, mixed } = common((i) => paramValue(i, name, decl))}
            {@const changed = sel.some((i) => i.options.params !== undefined && name in i.options.params)}
            {@const id = `studio-param-${name}`}
            <div class="row" class:changed class:mixed data-param={name}>
              {#if decl.type === "boolean"}
                <label class="check" for={id}>
                  <input {id} type="checkbox" checked={!mixed && Boolean(value)} use:indeterminate={mixed} onchange={(e) => setParam(name, e.currentTarget.checked)} />
                  <span>{name}</span>
                </label>
              {:else}
                <label for={id}>{name}</label>
                <div class="control">
                  {#if decl.type === "integer"}
                    <input type="range" aria-label={name} min={decl.min} max={decl.max} step="1" value={Number(value)} oninput={(e) => setParam(name, Number(e.currentTarget.value))} />
                    <input {id} class="num" type="number" min={decl.min} max={decl.max} step="1" value={mixed ? "" : Number(value)} placeholder={mixed ? t("studio.mixed") : undefined} oninput={(e) => { const raw = e.currentTarget.value; const n = Number(raw); if (raw.trim() !== "" && Number.isInteger(n)) setParam(name, n); }} />
                  {:else}
                    <select {id} value={mixed ? "" : String(value)} onchange={(e) => setParam(name, e.currentTarget.value)}>
                      {#if mixed}
                        <option value="" disabled>{t("studio.mixed")}</option>
                      {/if}
                      {#each decl.values as v (v)}
                        <option value={v}>{v}</option>
                      {/each}
                    </select>
                  {/if}
                </div>
              {/if}
              <button type="button" class="reset" disabled={!changed} aria-label={t("studio.resetOption", { option: name })} title={t("studio.default", { value: String(decl.default) })} onclick={() => studio.resetParam(ids, name, t("studio.act.reset"))}>↺</button>
              <p class="desc">{decl.description}</p>
              {#if errors[`param:${name}`]}
                <p class="error" role="alert">{errors[`param:${name}`]}</p>
              {/if}
            </div>
          {/each}
        </fieldset>
      {/if}

      {#if shape && shape.layers.length > 1}
        <fieldset>
          <legend>{t("studio.layers")}</legend>
          {#each shape.layers as layer (layer)}
            {@const { value, mixed } = common((i) => i.options.layerColors?.[layer])}
            {@const changed = sel.some((i) => i.options.layerColors?.[layer] !== undefined)}
            {@const id = `studio-layer-${layer}`}
            <div class="row" class:changed class:mixed data-layer={layer}>
              <label for={id}>{layer}</label>
              <div class="control">
                <input type="color" aria-label={`${layer}: ${t("studio.useColor")}`} value={!mixed && value && HEX6.test(value) ? value : "#000000"} oninput={(e) => setLayer(layer, e.currentTarget.value)} />
                <input {id} class="text" type="text" dir="ltr" spellcheck="false" autocomplete="off" value={mixed ? "" : (value ?? "")} placeholder={mixed ? t("studio.mixed") : t("studio.layerDefault")} onchange={(e) => { if (!(mixed && e.currentTarget.value.trim() === "")) setLayer(layer, e.currentTarget.value); }} />
              </div>
              <button type="button" class="reset" disabled={!changed} aria-label={t("studio.resetOption", { option: layer })} onclick={() => setLayer(layer, "")}>↺</button>
              {#if errors[`layer:${layer}`]}
                <p class="error" role="alert">{errors[`layer:${layer}`]}</p>
              {/if}
            </div>
          {/each}
        </fieldset>
      {/if}
    </div>
  {/if}
</section>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  .hint {
    margin: 0.5rem 0.75rem;
    color: var(--sl-color-gray-2);
  }
  .body {
    overflow-y: auto;
    padding: 0 0.75rem 1rem;
    display: grid;
    gap: 0.75rem;
    align-content: start;
  }
  .count {
    margin: 0;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .tools + .tools {
    margin-block-start: 0.375rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  fieldset {
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    padding: 0.5rem 0.625rem 0.625rem;
    margin: 0;
    min-width: 0;
  }
  legend {
    font-weight: 600;
    font-size: var(--sl-text-sm);
    padding: 0 0.25rem;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .previews {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem;
  }
  .previews li {
    margin: 0;
    display: grid;
    justify-items: center;
    gap: 0.25rem;
  }
  .preview {
    display: block;
  }
  .size {
    font-size: var(--sl-text-2xs, 0.75rem);
    color: var(--sl-color-gray-3);
  }
  .row {
    display: grid;
    grid-template-columns: minmax(6rem, 1fr) minmax(0, 1.6fr) auto;
    align-items: center;
    gap: 0.25rem 0.5rem;
    padding: 0.25rem 0;
    margin: 0;
  }
  .row + .row {
    border-block-start: 1px solid var(--sl-color-hairline, var(--sl-color-gray-6));
  }
  .row > label {
    font-size: var(--sl-text-sm);
  }
  .row.changed > label,
  .row.changed .check span {
    font-weight: 600;
  }
  .check {
    grid-column: 1 / 3;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .control {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    min-width: 0;
  }
  .control input[type="range"] {
    flex: 1;
    min-width: 0;
  }
  .num {
    width: 4.75rem;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  input[type="color"] {
    inline-size: 2rem;
    block-size: 2rem;
    padding: 0;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.25rem;
    background: none;
  }
  .reset {
    inline-size: 2rem;
    block-size: 2rem;
  }
  .desc,
  .error {
    grid-column: 1 / -1;
    margin: 0;
    font-size: var(--sl-text-xs);
  }
  .desc {
    color: var(--sl-color-gray-3);
  }
  .error {
    color: var(--sl-color-red-high, #b00020);
  }
</style>
