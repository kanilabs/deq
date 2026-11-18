<script lang="ts">
  import { DEFAULT_OPTIONS, getShape, type ParameterDecl } from "@0xdolan/deq-core";

  import type { StudioKey, Translate } from "../i18n.ts";
  import { OPTION_KEYS, optionValue, renderOptions, type Item, type OptionKey } from "../model.ts";
  import { renderCached } from "../render.ts";
  import type { Studio } from "../store.svelte.ts";
  import { svgMarkup } from "../svg.ts";

  interface Props {
    studio: Studio;
    t: Translate;
  }
  let { studio, t }: Props = $props();

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

  const item = $derived(studio.current);
  const shape = $derived(item ? getShape(item.shape) : undefined);
  let errors = $state<Record<string, string>>({});

  const optLabel = (key: OptionKey) => t(`studio.opt.${key}` as StudioKey);
  const valLabel = (v: string) => t(`studio.val.${v}` as StudioKey);
  const HEX6 = /^#[0-9a-f]{6}$/iu;

  function setError(key: string, message: string | undefined): void {
    const { [key]: _drop, ...rest } = errors;
    errors = message ? { ...rest, [key]: message } : rest;
  }

  function setOption(it: Item, key: OptionKey, value: unknown): void {
    const message = studio.setOptions(
      [it.id],
      { [key]: value },
      t("studio.act.edit", { option: optLabel(key) }),
      `opt:${it.id}:${key}`,
    );
    setError(key, message);
  }

  function numberInput(it: Item, key: OptionKey, raw: string): void {
    if (raw.trim() === "") return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setOption(it, key, n);
  }

  function colorText(it: Item, key: OptionKey, raw: string): void {
    const value = raw.trim();
    if (value === "") {
      studio.resetOption([it.id], key, t("studio.act.reset"));
      setError(key, undefined);
      return;
    }
    setOption(it, key, value);
  }

  function reset(it: Item, key: OptionKey): void {
    studio.resetOption([it.id], key, t("studio.act.reset"));
    setError(key, undefined);
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

  function setParam(it: Item, name: string, value: number | boolean | string): void {
    setError(`param:${name}`, studio.setParam(it.id, name, value, t("studio.act.edit", { option: name })));
  }

  function setLayer(it: Item, layer: string, raw: string): void {
    const value = raw.trim();
    setError(
      `layer:${layer}`,
      studio.setLayerColor(it.id, layer, value === "" ? undefined : value, t("studio.act.edit", { option: layer })),
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
  {#if !item || !shape}
    <p class="hint">
      {studio.selection.length > 1
        ? t("studio.multiSelected", { count: studio.selection.length })
        : t("studio.nothingSelected")}
    </p>
  {:else}
    {@const it = item}
    <div class="body">
      <div class="actions">
        <button type="button" onclick={() => studio.duplicate([it.id], t("studio.act.duplicate"))}>{t("studio.duplicate")}</button>
        <button type="button" onclick={() => studio.remove([it.id], t("studio.act.delete"))} disabled={it.locked}>{t("studio.delete")}</button>
        <button type="button" data-action="reset-shape" onclick={() => { studio.resetItems([it.id], t("studio.act.reset")); errors = {}; }}>{t("studio.resetShape")}</button>
        <button type="button" data-action="reset-all" onclick={() => { studio.resetItems(studio.doc.items.map((i) => i.id), t("studio.act.reset")); errors = {}; }}>{t("studio.resetAll")}</button>
      </div>

      <fieldset>
        <legend>{t("studio.preview")}</legend>
        <ul class="previews" role="list">
          {#each PREVIEW_SIZES as size (size)}
            <li>
              <span class="preview" style:width={`${size}px`} style:height={`${size}px`} aria-hidden="true" use:svgMarkup={previewMarkup(it, size)}></span>
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
          placeholder={shape.names.en}
          oninput={(e) => studio.setName(it.id, e.currentTarget.value, t("studio.act.rename"))}
        />
      </label>

      <fieldset class="pair">
        <legend>{t("studio.position")}</legend>
        <label class="field">
          <span>{t("studio.x")}</span>
          <input type="number" step="1" value={it.x} onchange={(e) => { const n = Number(e.currentTarget.value); if (Number.isFinite(n)) studio.moveBy([it.id], n - it.x, 0, t("studio.act.move")); }} />
        </label>
        <label class="field">
          <span>{t("studio.y")}</span>
          <input type="number" step="1" value={it.y} onchange={(e) => { const n = Number(e.currentTarget.value); if (Number.isFinite(n)) studio.moveBy([it.id], 0, n - it.y, t("studio.act.move")); }} />
        </label>
      </fieldset>

      <fieldset>
        <legend>{t("studio.options")}</legend>
        {#each OPTION_KEYS as key (key)}
          {@const c = CONTROLS[key]}
          {@const value = optionValue(it, key)}
          {@const changed = key in it.options}
          {@const id = `studio-opt-${key}`}
          <div class="row" class:changed data-option={key}>
            {#if c.type === "boolean"}
              <label class="check" for={id}>
                <input {id} type="checkbox" checked={Boolean(value)} onchange={(e) => setOption(it, key, e.currentTarget.checked)} />
                <span>{optLabel(key)}</span>
              </label>
            {:else}
              <label for={id}>{optLabel(key)}</label>
              <div class="control">
                {#if c.type === "number"}
                  {#if c.slider}
                    <input type="range" aria-label={optLabel(key)} min={c.slider.min} max={c.slider.max} step={c.step} value={Number(value)} oninput={(e) => numberInput(it, key, e.currentTarget.value)} />
                  {/if}
                  <input {id} class="num" type="number" min={c.min} max={c.max} step={c.step} value={Number(value)} oninput={(e) => numberInput(it, key, e.currentTarget.value)} aria-describedby={errors[key] ? `${id}-err` : undefined} />
                {:else if c.type === "enum"}
                  <select {id} value={String(value)} onchange={(e) => setOption(it, key, e.currentTarget.value)}>
                    {#each c.values as v (v)}
                      <option value={v}>{valLabel(v)}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    type="color"
                    aria-label={`${optLabel(key)}: ${t("studio.useColor")}`}
                    value={HEX6.test(String(value)) ? String(value) : "#000000"}
                    oninput={(e) => setOption(it, key, e.currentTarget.value)}
                  />
                  <input
                    {id}
                    class="text"
                    type="text"
                    dir="ltr"
                    spellcheck="false"
                    autocomplete="off"
                    value={changed ? String(value) : ""}
                    placeholder={String(DEFAULT_OPTIONS[key])}
                    onchange={(e) => colorText(it, key, e.currentTarget.value)}
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
              onclick={() => reset(it, key)}>↺</button>
            {#if errors[key]}
              <p class="error" id={`${id}-err`} role="alert">{errors[key]}</p>
            {/if}
          </div>
        {/each}
      </fieldset>

      {#if Object.keys(shape.parameters).length > 0}
        <fieldset>
          <legend>{t("studio.params")}</legend>
          {#each Object.entries(shape.parameters) as [name, decl] (name)}
            {@const value = paramValue(it, name, decl)}
            {@const changed = it.options.params !== undefined && name in it.options.params}
            {@const id = `studio-param-${name}`}
            <div class="row" class:changed data-param={name}>
              {#if decl.type === "boolean"}
                <label class="check" for={id}>
                  <input {id} type="checkbox" checked={Boolean(value)} onchange={(e) => setParam(it, name, e.currentTarget.checked)} />
                  <span>{name}</span>
                </label>
              {:else}
                <label for={id}>{name}</label>
                <div class="control">
                  {#if decl.type === "integer"}
                    <input type="range" aria-label={name} min={decl.min} max={decl.max} step="1" value={Number(value)} oninput={(e) => setParam(it, name, Number(e.currentTarget.value))} />
                    <input {id} class="num" type="number" min={decl.min} max={decl.max} step="1" value={Number(value)} oninput={(e) => { const n = Number(e.currentTarget.value); if (Number.isInteger(n)) setParam(it, name, n); }} />
                  {:else}
                    <select {id} value={String(value)} onchange={(e) => setParam(it, name, e.currentTarget.value)}>
                      {#each decl.values as v (v)}
                        <option value={v}>{v}</option>
                      {/each}
                    </select>
                  {/if}
                </div>
              {/if}
              <button type="button" class="reset" disabled={!changed} aria-label={t("studio.resetOption", { option: name })} title={t("studio.default", { value: String(decl.default) })} onclick={() => studio.resetParam(it.id, name, t("studio.act.reset"))}>↺</button>
              <p class="desc">{decl.description}</p>
              {#if errors[`param:${name}`]}
                <p class="error" role="alert">{errors[`param:${name}`]}</p>
              {/if}
            </div>
          {/each}
        </fieldset>
      {/if}

      {#if shape.layers.length > 1}
        <fieldset>
          <legend>{t("studio.layers")}</legend>
          {#each shape.layers as layer (layer)}
            {@const value = it.options.layerColors?.[layer]}
            {@const id = `studio-layer-${layer}`}
            <div class="row" class:changed={value !== undefined} data-layer={layer}>
              <label for={id}>{layer}</label>
              <div class="control">
                <input type="color" aria-label={`${layer}: ${t("studio.useColor")}`} value={value && HEX6.test(value) ? value : "#000000"} oninput={(e) => setLayer(it, layer, e.currentTarget.value)} />
                <input {id} class="text" type="text" dir="ltr" spellcheck="false" autocomplete="off" value={value ?? ""} placeholder={t("studio.layerDefault")} onchange={(e) => setLayer(it, layer, e.currentTarget.value)} />
              </div>
              <button type="button" class="reset" disabled={value === undefined} aria-label={t("studio.resetOption", { option: layer })} onclick={() => setLayer(it, layer, "")}>↺</button>
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
