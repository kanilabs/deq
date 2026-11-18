<script lang="ts">
  import { listCategories, listShapes, type ShapeData } from "@0xdolan/deq-core";

  import type { StudioKey, Translate } from "../i18n.ts";
  import { DRAG_TYPE } from "../model.ts";
  import { renderCached } from "../render.ts";
  import { searchShapes, searchText } from "../search.ts";
  import { svgMarkup } from "../svg.ts";

  interface Props {
    t: Translate;
    locale: "en" | "ckb" | "kmr";
    onadd: (shape: string) => void;
  }
  let { t, locale, onadd }: Props = $props();

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

  function dragStart(e: DragEvent, id: string): void {
    e.dataTransfer?.setData(DRAG_TYPE, id);
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  }
</script>

<section class="library" aria-labelledby="studio-library-h">
  <h2 id="studio-library-h" class="panel-title">{t("studio.library")}</h2>
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
