<script lang="ts">
  import { shapeOf } from "../shapes.ts";

  import type { Translate } from "../i18n.ts";
  import type { Item } from "../model.ts";
  import { renderOptions } from "../model.ts";
  import { renderCached } from "../render.ts";
  import type { Studio } from "../store.svelte.ts";
  import { svgMarkup } from "../svg.ts";

  interface Props {
    studio: Studio;
    t: Translate;
    locale: "en" | "ckb" | "kmr";
  }
  let { studio, t, locale }: Props = $props();

  /** Top of the stack first, as in other editors; the document draws later items on top. */
  const rows = $derived([...studio.doc.items].reverse());
  const selectedIds = $derived(new Set(studio.selection));
  const top = $derived(studio.doc.items.at(-1)?.id);
  const bottom = $derived(studio.doc.items[0]?.id);

  function nameOf(item: Item): string {
    if (item.name) return item.name;
    const names = shapeOf(item.shape).names;
    return (locale === "en" ? null : names[locale].text) ?? names.en;
  }

  function thumb(item: Item): string {
    try {
      return renderCached(item.shape, renderOptions(item, { size: 20, title: "", padding: 0 }));
    } catch {
      return "";
    }
  }

  const groupNumber = (item: Item) => (item.group ? item.group.slice(1) : "");
</script>

<section class="layers" aria-labelledby="studio-layers-h">
  <h2 id="studio-layers-h" class="panel-title">{t("studio.tab.layers")}</h2>
  {#if rows.length === 0}
    <p class="empty">{t("studio.layersEmpty")}</p>
  {:else}
    <ul class="list" aria-label={t("studio.layerList")}>
      {#each rows as item (item.id)}
        {@const name = nameOf(item)}
        <li class="layer-row" class:selected={selectedIds.has(item.id)} class:hidden={item.hidden} data-id={item.id}>
          <button
            type="button"
            class="pick"
            aria-pressed={selectedIds.has(item.id)}
            onclick={(e) => studio.select(item.id, e.shiftKey || e.ctrlKey || e.metaKey)}
          >
            <span class="thumb" aria-hidden="true" use:svgMarkup={thumb(item)}></span>
            <span class="name">{name}</span>
            {#if item.group}
              <span class="tag">{t("studio.groupLabel", { n: groupNumber(item) })}</span>
            {/if}
          </button>
          <button
            type="button"
            class="icon"
            data-flag="locked"
            aria-pressed={Boolean(item.locked)}
            aria-label={t("studio.lockItem", { name })}
            title={t("studio.lockItem", { name })}
            onclick={() => studio.setFlag([item.id], "locked", t("studio.act.lock"), !item.locked)}
          >{item.locked ? "🔒" : "🔓"}</button>
          <button
            type="button"
            class="icon"
            data-flag="hidden"
            aria-pressed={Boolean(item.hidden)}
            aria-label={t("studio.hideItem", { name })}
            title={t("studio.hideItem", { name })}
            onclick={() => studio.setFlag([item.id], "hidden", t("studio.act.hide"), !item.hidden)}
          >{item.hidden ? "◌" : "●"}</button>
          <button
            type="button"
            class="icon"
            data-move="up"
            disabled={item.id === top}
            aria-label={t("studio.raiseItem", { name })}
            title={t("studio.raiseItem", { name })}
            onclick={() => studio.arrange("forward", t("studio.act.order"), [item.id])}
          >↑</button>
          <button
            type="button"
            class="icon"
            data-move="down"
            disabled={item.id === bottom}
            aria-label={t("studio.lowerItem", { name })}
            title={t("studio.lowerItem", { name })}
            onclick={() => studio.arrange("backward", t("studio.act.order"), [item.id])}
          >↓</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .layers {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  .empty {
    margin: 0.5rem 0.75rem;
    color: var(--sl-color-gray-2);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0 0.5rem 1rem;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
  }
  .layer-row {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    margin: 0;
    padding: 0.125rem 0.25rem;
    border-radius: 0.375rem;
  }
  .layer-row.selected {
    background: var(--sl-color-accent-low);
  }
  .layer-row.hidden .thumb {
    opacity: 0.4;
  }
  .layer-row.hidden .name {
    font-style: italic;
    text-decoration: line-through;
  }
  .pick {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    border-color: transparent !important;
    background: transparent !important;
    text-align: start;
  }
  .thumb {
    display: block;
    flex: none;
    width: 20px;
    height: 20px;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag {
    flex: none;
    font-size: var(--sl-text-2xs, 0.75rem);
    padding: 0 0.3rem;
    border: 1px solid var(--sl-color-gray-4);
    border-radius: 999px;
    color: var(--sl-color-gray-2);
  }
  .icon {
    flex: none;
    inline-size: 2rem;
    padding: 0 !important;
    border-color: transparent !important;
  }
  .icon[aria-pressed="true"] {
    background: var(--sl-color-accent-low);
  }
</style>
