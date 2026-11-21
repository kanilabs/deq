<script lang="ts">
  import type { ExportItem } from "@0xdolan/deq-exporters";
  import { MAX_SEED, pattern, type PatternKind, type PatternResult, type Scene } from "@0xdolan/deq-generator";

  import "../panel.css";
  import { DEFAULT_STYLE, styleOptions, type InsertOptions, type SceneStyle as Style } from "../generate.ts";
  import { translator, type StudioMessages } from "../i18n.ts";
  import { svgMarkup } from "../svg.ts";
  import SceneExport from "./SceneExport.svelte";
  import SceneStyle from "./SceneStyle.svelte";

  interface Props {
    messages: StudioMessages;
    /** `page` previews and exports; `studio` adds the pattern to the canvas. */
    mode: "page" | "studio";
    oninsert?: (scene: Scene, insert: Omit<InsertOptions, "x" | "y">) => void;
  }
  let { messages, mode, oninsert }: Props = $props();
  const t = $derived(translator(messages));
  const id = $derived(`generate-${mode}`);

  let kind = $state<PatternKind>("band");
  let seed = $state(1);
  let motifText = $state("");
  let count = $state(9);
  let cols = $state(5);
  let rows = $state(5);
  let petals = $state(8);
  let spacing = $state(2);
  let style = $state<Style>({ ...DEFAULT_STYLE });

  const motifs = $derived(
    motifText
      .split(/[\s,]+/u)
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m !== ""),
  );

  const options = $derived({
    kind,
    seed,
    spacing,
    ...(motifs.length > 0 ? { motifs } : {}),
    ...(kind === "band" ? { count } : {}),
    ...(kind === "grid" || kind === "border" ? { cols: kind === "border" ? Math.max(3, cols) : cols } : {}),
    ...(kind === "grid" || kind === "border" ? { rows: kind === "border" ? Math.max(3, rows) : rows } : {}),
    ...(kind === "rosette" ? { petals } : {}),
  });

  const built = $derived.by((): { ok: PatternResult } | { error: string } => {
    try {
      return { ok: pattern({ ...options, ...styleOptions(style) }) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });

  function newSeed(): void {
    seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  }

  function exportItem(): ExportItem | undefined {
    if (!("ok" in built)) return undefined;
    return { pattern: { ...options, ...styleOptions(style) } };
  }

  function insert(): void {
    if (!("ok" in built) || !oninsert) return;
    const render = styleOptions(style);
    oninsert(built.ok.scene, {
      size: style.size,
      options: render,
      ...(render.colors ? { colors: render.colors } : {}),
    });
  }

  const intField = (e: Event, min: number, max: number, fallback: number, odd = false) => {
    const n = (e.currentTarget as HTMLInputElement).valueAsNumber;
    if (!Number.isInteger(n)) return fallback;
    const v = Math.min(max, Math.max(min, n));
    return odd && v % 2 === 0 ? Math.min(max, v + 1) : v;
  };
</script>

<div class="deq-panel" data-mode={mode} data-panel="generate">
  <div class="controls">
    <div class="grid">
      <label class="field" for={`${id}-kind`}>
        {t("studio.gen.kind")}
        <select id={`${id}-kind`} bind:value={kind}>
          <option value="band">{t("studio.gen.kind.band")}</option>
          <option value="grid">{t("studio.gen.kind.grid")}</option>
          <option value="rosette">{t("studio.gen.kind.rosette")}</option>
          <option value="border">{t("studio.gen.kind.border")}</option>
        </select>
      </label>
      <label class="field" for={`${id}-seed`}>
        {t("studio.gen.seed")}
        <input id={`${id}-seed`} type="number" min="0" max={MAX_SEED} step="1" value={seed}
          onchange={(e) => (seed = intField(e, 0, MAX_SEED, seed))} />
      </label>
      <button type="button" class="seed" data-action="seed" onclick={newSeed}>{t("studio.gen.random")}</button>
      {#if kind === "band"}
        <label class="field" for={`${id}-count`}>
          {t("studio.gen.count")}
          <input id={`${id}-count`} type="number" min="3" max="63" step="2" value={count}
            onchange={(e) => (count = intField(e, 3, 63, count, true))} />
        </label>
      {:else if kind === "rosette"}
        <label class="field" for={`${id}-petals`}>
          {t("studio.gen.petals")}
          <input id={`${id}-petals`} type="number" min="3" max="24" step="1" value={petals}
            onchange={(e) => (petals = intField(e, 3, 24, petals))} />
        </label>
      {:else}
        <label class="field" for={`${id}-cols`}>
          {t("studio.gen.cols")}
          <input id={`${id}-cols`} type="number" min={kind === "border" ? 3 : 1} max="32" step="1" value={cols}
            onchange={(e) => (cols = intField(e, kind === "border" ? 3 : 1, 32, cols))} />
        </label>
        <label class="field" for={`${id}-rows`}>
          {t("studio.gen.rows")}
          <input id={`${id}-rows`} type="number" min={kind === "border" ? 3 : 1} max="32" step="1" value={rows}
            onchange={(e) => (rows = intField(e, kind === "border" ? 3 : 1, 32, rows))} />
        </label>
      {/if}
      <label class="field" for={`${id}-spacing`}>
        {t("studio.gen.spacing")}
        <input id={`${id}-spacing`} type="range" min="0" max="24" step="1" bind:value={spacing} />
      </label>
    </div>
    <label class="field" for={`${id}-motifs`}>
      {t("studio.gen.motifs")}
      <input id={`${id}-motifs`} type="text" spellcheck="false" autocomplete="off" maxlength="2000"
        bind:value={motifText} aria-describedby={`${id}-motifs-hint`} />
      <small id={`${id}-motifs-hint`}>{t("studio.gen.motifsHint")}</small>
    </label>
    <SceneStyle bind:style {t} {id} background={mode === "page"} />
  </div>

  <div class="output">
    {#if "error" in built}
      <p class="error" role="alert">{built.error}</p>
    {:else}
      <figure class="preview" aria-label={t("studio.scene.preview")}>
        <div class="art" use:svgMarkup={built.ok.svg}></div>
      </figure>
      <p class="note">{t("studio.gen.used", { list: built.ok.motifs.join(", ") })}</p>
      {#if mode === "studio"}
        <button type="button" class="primary" data-action="insert" onclick={insert}>{t("studio.scene.insert")}</button>
      {:else}
        <SceneExport {t} {id} item={exportItem} />
      {/if}
    {/if}
  </div>
</div>
