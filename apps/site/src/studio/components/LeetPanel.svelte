<script lang="ts">
  import { DeqError } from "@0xdolan/deq-core";
  import type { ExportItem } from "@0xdolan/deq-exporters";
  import {
    MAX_DECODE_INPUT,
    MAX_INPUT,
    decodeLeet,
    sceneSvg,
    type LeetLevel,
    type Scene,
    type Script,
  } from "@0xdolan/deq-generator";

  import "../panel.css";
  import { slug } from "../exporting.ts";
  import {
    DEFAULT_STYLE,
    composeLeet,
    puaText,
    styleOptions,
    type Composed,
    type FrameKind,
    type InsertOptions,
    type SceneStyle as Style,
  } from "../generate.ts";
  import { translator, type StudioMessages } from "../i18n.ts";
  import { svgMarkup } from "../svg.ts";
  import SceneExport from "./SceneExport.svelte";
  import SceneStyle from "./SceneStyle.svelte";

  interface Props {
    messages: StudioMessages;
    /** `page` previews, copies and exports; `studio` adds the text to the canvas. */
    mode: "page" | "studio";
    oninsert?: (scene: Scene, insert: Omit<InsertOptions, "x" | "y">) => void;
  }
  let { messages, mode, oninsert }: Props = $props();
  const t = $derived(translator(messages));
  const id = $derived(`leet-${mode}`);

  let text = $state("Deq");
  let level = $state<LeetLevel>("basic");
  let script = $state<Script | "auto">("auto");
  let seed = $state(1);
  let letterSpacing = $state(2);
  let lineSpacing = $state(6);
  let align = $state<"start" | "center" | "end">("start");
  let frame = $state<FrameKind>("none");
  let frameSeed = $state(1);
  let guides = $state(false);
  let style = $state<Style>({ ...DEFAULT_STYLE });

  const layout = $derived({
    level,
    seed,
    letterSpacing,
    lineSpacing,
    align,
    ...(script === "auto" ? {} : { script }),
  });

  const built = $derived.by((): { ok: Composed; svg: string } | { error: string } => {
    try {
      const ok = composeLeet(text, layout, { kind: frame, seed: frameSeed });
      return { ok, svg: sceneSvg(ok.scene, styleOptions(style), ok.result.text.replace(/\n/gu, " ")) };
    } catch (e) {
      if (e instanceof DeqError && e.code === "LIMIT_EXCEEDED" && frame === "border") {
        return { error: t("studio.leet.tooLarge") };
      }
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });
  const composed = $derived("ok" in built ? built.ok : undefined);

  /** Line guides in scene units: the top and bottom of every text line. */
  const lines = $derived.by(() => {
    if (!composed) return [];
    const first = composed.scene.cells[0];
    const own = composed.result.scene.cells[0];
    const dy = (first?.y ?? 0) - (own?.y ?? 0);
    const ys = new Set(composed.result.scene.cells.map((c) => c.y + dy));
    return [...ys].sort((a, b) => a - b);
  });

  const pua = $derived(composed ? puaText(text, composed.result) : "");
  let copyStatus = $state("");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(pua);
      copyStatus = t("studio.leet.copied");
    } catch {
      copyStatus = t("studio.leet.copyFailed");
    }
  }

  function exportItem(): ExportItem | undefined {
    if (!composed) return undefined;
    const name = `leet-${slug(composed.result.text, "text")}`;
    const render = styleOptions(style);
    if (!composed.framed) return { leet: text, options: { ...layout, ...render }, name };
    return { scene: composed.scene, options: render, title: composed.result.text, name };
  }

  function insert(): void {
    if (!composed || !oninsert) return;
    const render = styleOptions(style);
    const count = composed.result.scene.cells.length;
    const names = composed.names.map((n, i) => (i < count ? n : undefined));
    oninsert(composed.scene, {
      size: style.size,
      options: render,
      ...(render.colors ? { colors: render.colors } : {}),
      names,
      shapeNames: names.map((n) => (n ? `Leet ${n}` : undefined)),
    });
  }

  // Decoding ------------------------------------------------------------------------------
  let pasted = $state("");
  let decoded = $state<{ text: string } | { error: string } | undefined>();

  function decode(svg: string): void {
    try {
      decoded = { text: decodeLeet(svg).text };
    } catch (e) {
      decoded = { error: t("studio.leet.decode.error", { message: e instanceof Error ? e.message : String(e) }) };
    }
  }
  async function decodeFile(file: File | undefined): Promise<void> {
    if (!file) return;
    if (file.size > MAX_DECODE_INPUT) {
      decoded = { error: t("studio.leet.decode.error", { message: file.name }) };
      return;
    }
    decode(await file.text());
  }

  const intField = (e: Event, min: number, max: number, fallback: number) => {
    const n = (e.currentTarget as HTMLInputElement).valueAsNumber;
    return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
</script>

<div class="deq-panel" data-mode={mode} data-panel="leet">
  <div class="controls">
    <label class="field" for={`${id}-text`}>
      {t("studio.leet.text")}
      <textarea id={`${id}-text`} rows="2" maxlength={MAX_INPUT} spellcheck="false" bind:value={text}
        aria-describedby={`${id}-text-hint`}></textarea>
      <small id={`${id}-text-hint`}>{t("studio.leet.textHint")}</small>
    </label>
    <div class="grid">
      <label class="field" for={`${id}-level`}>
        {t("studio.leet.level")}
        <select id={`${id}-level`} bind:value={level}>
          <option value="basic">{t("studio.leet.level.basic")}</option>
          <option value="advanced">{t("studio.leet.level.advanced")}</option>
          <option value="full">{t("studio.leet.level.full")}</option>
        </select>
      </label>
      <label class="field" for={`${id}-script`}>
        {t("studio.leet.script")}
        <select id={`${id}-script`} bind:value={script}>
          <option value="auto">{t("studio.leet.script.auto")}</option>
          <option value="latin">{t("studio.leet.script.latin")}</option>
          <option value="sorani">{t("studio.leet.script.sorani")}</option>
        </select>
      </label>
      {#if level === "advanced"}
        <label class="field" for={`${id}-seed`}>
          {t("studio.leet.seed")}
          <input id={`${id}-seed`} type="number" min="0" max="4294967295" step="1" value={seed}
            onchange={(e) => (seed = intField(e, 0, 4294967295, seed))} />
        </label>
      {/if}
      <label class="field" for={`${id}-align`}>
        {t("studio.leet.align")}
        <select id={`${id}-align`} bind:value={align}>
          <option value="start">{t("studio.leet.align.start")}</option>
          <option value="center">{t("studio.leet.align.center")}</option>
          <option value="end">{t("studio.leet.align.end")}</option>
        </select>
      </label>
      <label class="field" for={`${id}-ls`}>
        {t("studio.leet.letterSpacing")}
        <input id={`${id}-ls`} type="range" min="0" max="24" step="1" bind:value={letterSpacing} />
      </label>
      <label class="field" for={`${id}-lh`}>
        {t("studio.leet.lineSpacing")}
        <input id={`${id}-lh`} type="range" min="0" max="48" step="1" bind:value={lineSpacing} />
      </label>
      <label class="field" for={`${id}-frame`}>
        {t("studio.leet.frame")}
        <select id={`${id}-frame`} bind:value={frame}>
          <option value="none">{t("studio.leet.frame.none")}</option>
          <option value="band">{t("studio.leet.frame.band")}</option>
          <option value="border">{t("studio.leet.frame.border")}</option>
        </select>
      </label>
      {#if frame !== "none"}
        <label class="field" for={`${id}-fseed`}>
          {t("studio.leet.frameSeed")}
          <input id={`${id}-fseed`} type="number" min="0" max="4294967295" step="1" value={frameSeed}
            onchange={(e) => (frameSeed = intField(e, 0, 4294967295, frameSeed))} />
        </label>
      {/if}
    </div>
    <SceneStyle bind:style {t} {id} background={mode === "page"} />
    {#if mode === "page"}
      <label class="check">
        <input type="checkbox" bind:checked={guides} />
        {t("studio.leet.guides")}
      </label>
    {/if}
  </div>

  <div class="output">
    {#if "error" in built}
      <p class="error" role="alert">{built.error}</p>
    {:else}
      {#if built.ok.result.unknown.length > 0}
        <p class="note" role="status">{t("studio.leet.unknown", { chars: built.ok.result.unknown.join(" ") })}</p>
      {/if}
      <figure class="preview" aria-label={t("studio.scene.preview")}>
        <div class="art" use:svgMarkup={built.svg}></div>
        {#if guides && mode === "page"}
          <svg class="guides" viewBox={`0 0 ${built.ok.scene.width} ${built.ok.scene.height}`} preserveAspectRatio="none"
            aria-hidden="true">
            {#each lines as y (y)}
              <line x1="0" x2={built.ok.scene.width} y1={y} y2={y} />
              <line class="base" x1="0" x2={built.ok.scene.width} y1={y + 24} y2={y + 24} />
            {/each}
          </svg>
        {/if}
      </figure>
      {#if mode === "studio"}
        <button type="button" class="primary" data-action="insert" onclick={insert}>{t("studio.scene.insert")}</button>
      {:else}
        <section class="pua" aria-labelledby={`${id}-pua-h`}>
          <h2 id={`${id}-pua-h`}>{t("studio.leet.pua")}</h2>
          <p class="deq-leet pua-text" aria-label={built.ok.result.text} dir="ltr">{pua}</p>
          <button type="button" data-action="copy" onclick={() => void copy()}>{t("studio.leet.copy")}</button>
          <p class="status" role="status">{copyStatus}</p>
        </section>
        <SceneExport {t} {id} item={exportItem} />
      {/if}
    {/if}

    {#if mode === "page"}
      <section class="decode" aria-labelledby={`${id}-decode-h`}>
        <h2 id={`${id}-decode-h`}>{t("studio.leet.decode")}</h2>
        <p>{t("studio.leet.decode.body")}</p>
        <label class="field" for={`${id}-paste`}>
          {t("studio.leet.decode.paste")}
          <textarea id={`${id}-paste`} rows="3" spellcheck="false" bind:value={pasted}></textarea>
        </label>
        <div class="row">
          <button type="button" data-action="decode" disabled={pasted.trim() === ""} onclick={() => decode(pasted)}
            >{t("studio.leet.decode.run")}</button>
          <label class="file">
            {t("studio.leet.decode.file")}
            <input type="file" accept=".svg,image/svg+xml"
              onchange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                void decodeFile(file);
              }} />
          </label>
        </div>
        {#if decoded && "text" in decoded}
          <p class="status" role="status" data-decoded>{t("studio.leet.decode.result", { text: decoded.text })}</p>
        {:else if decoded}
          <p class="error" role="alert">{decoded.error}</p>
        {/if}
      </section>
    {/if}
  </div>
</div>
