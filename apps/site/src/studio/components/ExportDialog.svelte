<script lang="ts">
  import { initRaster } from "@0xdolan/deq-exporters";
  import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm?url";

  import { downloadFile } from "../db.ts";
  import { FORMAT_GROUPS, SCALED, exportItems, runExport, type ExportFormat } from "../exporting.ts";
  import type { StudioKey, Translate } from "../i18n.ts";
  import type { Studio } from "../store.svelte.ts";

  interface Props {
    studio: Studio;
    t: Translate;
  }
  let { studio, t }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let format = $state<ExportFormat>("svg");
  let scope = $state<"selection" | "all">("all");
  let scales = $state<number[]>([1]);
  let working = $state(false);
  let error = $state("");
  let done = $state("");

  const SCALE_CHOICES = [1, 2, 3, 4] as const;
  const visible = $derived(studio.doc.items.filter((i) => !i.hidden));
  const items = $derived(scope === "selection" ? studio.selected : visible);

  export function isOpen(): boolean {
    return dialog?.open ?? false;
  }
  export function open(): void {
    scope = studio.selection.length > 0 ? "selection" : "all";
    error = "";
    done = "";
    dialog?.showModal();
  }

  /** Load the rasteriser's WebAssembly (bundled with the site) before a raster export. */
  const prepare = () => initRaster({ resvg: fetch(resvgWasm) });

  function toggleScale(scale: number, on: boolean): void {
    const next = on ? [...scales, scale] : scales.filter((s) => s !== scale);
    scales = next.length > 0 ? next.toSorted((a, b) => a - b) : [scale];
  }

  async function download(): Promise<void> {
    if (items.length === 0 || working) return;
    working = true;
    error = "";
    done = "";
    try {
      const list = exportItems(items, (id) => studio.customDef(id));
      const file = await runExport(format, list, SCALED.has(format) ? { scales } : {}, prepare);
      downloadFile(file.name, file.data, file.type);
      done = t("studio.export.done", { name: file.name });
      studio.announce(done);
    } catch (e) {
      error = t("studio.export.error", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      working = false;
    }
  }
</script>

<dialog bind:this={dialog} class="export" aria-labelledby="studio-export-h">
  <form
    method="dialog"
    onsubmit={(e) => {
      e.preventDefault();
      void download();
    }}
  >
    <header>
      <h2 id="studio-export-h">{t("studio.export.title")}</h2>
    </header>
    <label class="field">
      {t("studio.export.format")}
      <select name="format" bind:value={format}>
        {#each FORMAT_GROUPS as group (group.id)}
          <optgroup label={t(`studio.export.group.${group.id}` as StudioKey)}>
            {#each group.formats as f (f)}
              <option value={f}>{f}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
    <fieldset>
      <legend>{t("studio.export.scope")}</legend>
      <label
        ><input type="radio" name="scope" value="selection" bind:group={scope} disabled={studio.selection.length === 0} />
        {t("studio.export.selection", { count: studio.selection.length })}</label
      >
      <label
        ><input type="radio" name="scope" value="all" bind:group={scope} />
        {t("studio.export.all", { count: visible.length })}</label
      >
    </fieldset>
    {#if SCALED.has(format)}
      <fieldset>
        <legend>{t("studio.export.scales")}</legend>
        {#each SCALE_CHOICES as s (s)}
          <label
            ><input
              type="checkbox"
              name="scale"
              value={s}
              checked={scales.includes(s)}
              onchange={(e) => toggleScale(s, e.currentTarget.checked)}
            />
            {s}×</label
          >
        {/each}
      </fieldset>
    {/if}
    <p class="note">{items.length === 0 ? t("studio.export.nothing") : t("studio.export.zip")}</p>
    <p class="status" role="status">{working ? t("studio.export.working") : done}</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <footer>
      <button type="button" onclick={() => dialog?.close()}>{t("studio.export.cancel")}</button>
      <button type="submit" class="primary" data-action="download" disabled={working || items.length === 0}
        >{t("studio.export.download")}</button
      >
    </footer>
  </form>
</dialog>

<style>
  .export {
    /* Starlight's reset sets `margin: 0`, which would pin a modal dialog to the corner. */
    margin: auto;
    width: min(26rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 1rem 1.25rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.75rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-white);
  }
  .export::backdrop {
    background: rgb(0 0 0 / 0.5);
  }
  form {
    display: grid;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: var(--sl-text-h4);
  }
  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    font-size: var(--sl-text-sm);
  }
  legend {
    padding: 0 0.25rem;
  }
  label {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    min-height: 2rem;
  }
  .field {
    display: grid;
  }
  .note,
  .status,
  .error {
    margin: 0;
    font-size: var(--sl-text-sm);
  }
  .status:empty {
    display: none;
  }
  .error {
    color: var(--sl-color-red-high, #f87171);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .primary {
    background: var(--sl-color-accent-low);
    border-color: var(--sl-color-accent);
  }
</style>
