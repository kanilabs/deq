<script lang="ts">
  import { listCategories, listShapes, type ShapeData } from "@0xdolan/deq-core";

  import { toSpecJson, type CustomDef } from "../custom.ts";
  import { downloadText } from "../db.ts";
  import type { StudioKey, Translate } from "../i18n.ts";
  import { DRAG_TYPE } from "../model.ts";
  import { renderCached } from "../render.ts";
  import { searchShapes, searchText } from "../search.ts";
  import type { Studio } from "../store.svelte.ts";
  import { svgMarkup } from "../svg.ts";

  interface Props {
    t: Translate;
    locale: "en" | "ckb" | "kmr";
    studio: Studio;
    onadd: (shape: string) => void;
    /** Open the shape editor: on `def`, or on a new shape. */
    onedit: (def?: CustomDef) => void;
  }
  let { t, locale, studio, onadd, onedit }: Props = $props();

  /** Largest spec JSON file accepted for import. */
  const MAX_IMPORT = 256 * 1024;

  const shapes = listShapes().filter((s) => s.category !== "brand");
  const categories = listCategories().filter((c) => c !== "brand");
  const index = new Map(shapes.map((s) => [s.id, searchText(s)]));

  let query = $state("");
  let category = $state("");
  let input: HTMLInputElement | undefined = $state();
  const results = $derived(searchShapes(shapes, query, category, index));

  const nameOf = (s: ShapeData): string =>
    (locale === "en" ? null : s.names[locale].text) ?? s.names.en;

  export function focusSearch(): void {
    input?.focus();
    input?.select();
  }

  async function importFile(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT) throw new Error(t("studio.shape.tooBig"));
      const def = await studio.importCustom(await file.text(), t("studio.shape.import"));
      studio.announce(t("studio.shape.imported", { name: def.name }));
    } catch (error) {
      studio.announce(t("studio.shape.importError", { error: (error as Error).message }));
    }
  }

  async function remove(def: CustomDef): Promise<void> {
    if (!confirm(t("studio.shape.deleteConfirm", { name: def.name }))) return;
    await studio.deleteCustom(def.id);
    studio.announce(t("studio.shape.deleted", { name: def.name }));
  }

  function dragStart(e: DragEvent, id: string): void {
    e.dataTransfer?.setData(DRAG_TYPE, id);
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  }
</script>

<section class="library" aria-labelledby="studio-library-h">
  <h2 id="studio-library-h" class="panel-title">{t("studio.library")}</h2>
  <section class="mine" aria-labelledby="studio-mine-h">
    <div class="mine-head">
      <h3 id="studio-mine-h">{t("studio.mine")}</h3>
      <button type="button" class="small" data-action="new-shape" onclick={() => onedit()}>{t("studio.shape.new")}</button>
      <label class="small file" title={t("studio.shape.importLabel")}>
        {t("studio.shape.import")}
        <input type="file" accept=".json,application/json" aria-label={t("studio.shape.importLabel")} onchange={importFile} />
      </label>
    </div>
    {#if !studio.persistent && studio.library.length > 0}
      <p class="hint">{t("studio.mine.session")}</p>
    {/if}
    {#if studio.library.length === 0}
      <p class="hint">{t("studio.mine.empty")}</p>
    {:else}
      <ul class="grid mine-grid" role="list">
        {#each studio.library as def (def.id)}
          <li class="mine-tile">
            <button
              type="button"
              class="tile"
              draggable="true"
              data-shape={def.id}
              title={def.name}
              aria-label={t("studio.add", { name: def.name })}
              ondragstart={(e) => dragStart(e, def.id)}
              onclick={() => onadd(def.id)}
            >
              <span class="glyph" aria-hidden="true" use:svgMarkup={renderCached(def.id, { size: 32, title: "" })}></span>
              <span class="name">{def.name}</span>
            </button>
            <div class="tile-actions">
              <button type="button" data-action="edit" aria-label={t("studio.shape.edit", { name: def.name })} title={t("studio.shape.edit", { name: def.name })} onclick={() => onedit(def)}>✎</button>
              <button type="button" data-action="export" aria-label={t("studio.shape.export", { name: def.name })} title={t("studio.shape.export", { name: def.name })} onclick={() => downloadText(`${def.id}.json`, toSpecJson(def))}>⤓</button>
              <button type="button" data-action="delete" aria-label={t("studio.shape.delete", { name: def.name })} title={t("studio.shape.delete", { name: def.name })} onclick={() => remove(def)}>✕</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
  <div class="filters">
    <label class="field">
      <span>{t("studio.search")}</span>
      <input
        bind:this={input}
        bind:value={query}
        type="search"
        placeholder={t("studio.searchPlaceholder")}
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    <label class="field">
      <span>{t("studio.category")}</span>
      <select bind:value={category}>
        <option value="">{t("studio.allCategories")}</option>
        {#each categories as c (c)}
          <option value={c}>{t(`category.${c}` as StudioKey)}</option>
        {/each}
      </select>
    </label>
  </div>
  <p class="count" role="status">{t("studio.results", { count: results.length })}</p>
  {#if results.length === 0}
    <p class="empty">{t("studio.noResults")}</p>
  {:else}
    <ul class="grid" role="list">
      {#each results as s (s.id)}
        <li>
          <button
            type="button"
            class="tile"
            draggable="true"
            data-shape={s.id}
            title={nameOf(s)}
            aria-label={t("studio.add", { name: nameOf(s) })}
            ondragstart={(e) => dragStart(e, s.id)}
            onclick={() => onadd(s.id)}
          >
            <span class="glyph" aria-hidden="true" use:svgMarkup={renderCached(s.id, { size: 32, title: "" })}></span>
            <span class="name">{nameOf(s)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .library {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  .mine {
    padding: 0 0.75rem 0.5rem;
    border-bottom: 1px solid var(--sl-color-gray-5);
    margin-bottom: 0.5rem;
  }
  .mine-head {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .mine-head h3 {
    margin: 0;
    margin-inline-end: auto;
    font-size: var(--sl-text-sm);
  }
  .small {
    font: inherit;
    font-size: var(--sl-text-xs);
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.375rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-white);
    cursor: pointer;
  }
  .file {
    position: relative;
    margin: 0;
  }
  .file:focus-within {
    outline: 2px solid var(--sl-color-accent);
    outline-offset: 2px;
  }
  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    cursor: pointer;
  }
  .hint {
    margin: 0.375rem 0 0;
    font-size: var(--sl-text-xs);
    color: var(--sl-color-gray-3);
  }
  .grid.mine-grid {
    grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
    padding: 0.375rem 0 0;
    overflow: visible;
    flex: none;
  }
  .mine-tile {
    display: grid;
    gap: 0.125rem;
  }
  .tile-actions {
    display: flex;
    justify-content: center;
    gap: 0.125rem;
  }
  .tile-actions button {
    font: inherit;
    font-size: var(--sl-text-xs);
    line-height: 1;
    min-width: 1.5rem;
    min-height: 1.5rem;
    padding: 0.125rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    background: none;
    color: var(--sl-color-gray-2);
    cursor: pointer;
  }
  .tile-actions button:hover,
  .tile-actions button:focus-visible {
    border-color: var(--sl-color-accent);
  }
  .filters {
    display: grid;
    gap: 0.5rem;
    padding: 0 0.75rem;
  }
  .count {
    margin: 0.5rem 0.75rem 0.25rem;
    font-size: var(--sl-text-xs);
    color: var(--sl-color-gray-3);
  }
  .empty {
    margin: 1rem 0.75rem;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0.25rem 0.75rem 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
    gap: 0.375rem;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
  }
  .grid li {
    margin: 0;
  }
  .tile {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.25rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-white);
    cursor: grab;
    font: inherit;
  }
  .tile:hover {
    border-color: var(--sl-color-accent);
  }
  .tile:focus-visible {
    outline: 2px solid var(--sl-color-accent);
    outline-offset: 2px;
  }
  .glyph {
    display: block;
    width: 32px;
    height: 32px;
  }
  .name {
    font-size: var(--sl-text-2xs, 0.75rem);
    line-height: 1.2;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    width: 100%;
  }
</style>
