<script lang="ts">
  import type { ExportFormat, ExportItem } from "@0xdolan/deq-exporters";
  import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm?url";

  import { downloadFile } from "../db.ts";
  import { SCALED, SCENE_FORMAT_GROUPS as groups } from "../formats.ts";
  import type { StudioKey, Translate } from "../i18n.ts";

  interface Props {
    t: Translate;
    id: string;
    /** The item to export, or undefined when there is nothing to export. */
    item: () => ExportItem | undefined;
  }
  let { t, id, item }: Props = $props();

  let format = $state<ExportFormat>("svg");
  let scale = $state(1);
  let working = $state(false);
  let status = $state("");
  let error = $state("");


  async function download(): Promise<void> {
    const it = item();
    if (!it || working) return;
    working = true;
    status = t("studio.export.working");
    error = "";
    try {
      // The exporters load on the first download, which keeps the page itself light.
      const [{ runExport }, { initRaster }] = await Promise.all([
        import("../exporting.ts"),
        import("@0xdolan/deq-exporters"),
      ]);
      /** Load the rasteriser's WebAssembly (bundled with the site) before a raster export. */
      const prepare = () => initRaster({ resvg: fetch(resvgWasm) });
      const file = await runExport(format, [it], SCALED.has(format) ? { scales: [scale] } : {}, prepare);
      downloadFile(file.name, file.data, file.type);
      status = t("studio.export.done", { name: file.name });
    } catch (e) {
      status = "";
      error = t("studio.export.error", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      working = false;
    }
  }
</script>

<form
  class="scene-export"
  aria-labelledby={`${id}-export-h`}
  onsubmit={(e) => {
    e.preventDefault();
    void download();
  }}
>
  <h2 id={`${id}-export-h`}>{t("studio.export.title")}</h2>
  <div class="row">
    <label class="field" for={`${id}-format`}>
      {t("studio.export.format")}
      <select id={`${id}-format`} bind:value={format}>
        {#each groups as group (group.id)}
          <optgroup label={t(`studio.export.group.${group.id}` as StudioKey)}>
            {#each group.formats as f (f)}
              <option value={f}>{f}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
    {#if SCALED.has(format)}
      <label class="field" for={`${id}-scale`}>
        {t("studio.export.scales")}
        <select id={`${id}-scale`} bind:value={scale}>
          {#each [1, 2, 3, 4] as s (s)}<option value={s}>{s}×</option>{/each}
        </select>
      </label>
    {/if}
    <button type="submit" class="primary" data-action="download" disabled={working}>{t("studio.export.download")}</button>
  </div>
  <p class="status" role="status">{status}</p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</form>
