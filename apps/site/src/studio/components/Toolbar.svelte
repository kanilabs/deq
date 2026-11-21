<script lang="ts">
  import type { StudioKey, Translate } from "../i18n.ts";
  import { displayCombo, type Action, type Bindings } from "../shortcuts.ts";
  import type { Overlays, Studio } from "../store.svelte.ts";

  interface Props {
    studio: Studio;
    t: Translate;
    apple: boolean;
    bindings: Bindings;
    run: (action: Action) => void;
  }
  let { studio, t, apple, bindings, run }: Props = $props();

  /** Tooltip with the first shortcut, for example "Undo (Ctrl+Z)". */
  const tip = (label: string, action: Action) => {
    const combo = bindings[action][0];
    return combo ? `${label} (${displayCombo(combo, apple)})` : label;
  };

  const TOGGLES: readonly { key: keyof Overlays; label: StudioKey; action: Action }[] = [
    { key: "grid", label: "studio.grid", action: "toggleGrid" },
    { key: "keylines", label: "studio.keylines", action: "toggleKeylines" },
    { key: "pixels", label: "studio.pixels", action: "togglePixels" },
    { key: "rulers", label: "studio.rulers", action: "toggleRulers" },
    { key: "snap", label: "studio.snap", action: "toggleSnap" },
  ];
</script>

<div class="toolbar" role="toolbar" aria-label={t("studio.toolbar")}>
  <div class="group" role="group" aria-label={t("studio.file")}>
    {#each [["open", "studio.open"], ["save", "studio.save"], ["share", "studio.share"], ["export", "studio.export"]] as const as [action, label] (action)}
      <button type="button" data-action={action} title={tip(t(`studio.action.${action}`), action)} onclick={() => run(action)}>{t(label)}</button>
    {/each}
  </div>
  <div class="group">
    <button type="button" data-action="undo" disabled={!studio.canUndo} title={tip(t("studio.undo"), "undo")} onclick={() => run("undo")}>{t("studio.undo")}</button>
    <button type="button" data-action="redo" disabled={!studio.canRedo} title={tip(t("studio.redo"), "redo")} onclick={() => run("redo")}>{t("studio.redo")}</button>
  </div>
  <div class="group" role="group" aria-label={t("studio.zoom")}>
    <button type="button" data-action="zoomOut" aria-label={t("studio.zoomOut")} title={tip(t("studio.zoomOut"), "zoomOut")} onclick={() => run("zoomOut")}>−</button>
    <button type="button" data-action="zoomReset" class="zoom" title={tip(t("studio.zoomReset"), "zoomReset")} aria-label={`${t("studio.zoomLevel", { percent: Math.round(studio.view.zoom * 100) })}. ${t("studio.zoomReset")}`} onclick={() => run("zoomReset")}>{Math.round(studio.view.zoom * 100)}%</button>
    <button type="button" data-action="zoomIn" aria-label={t("studio.zoomIn")} title={tip(t("studio.zoomIn"), "zoomIn")} onclick={() => run("zoomIn")}>+</button>
    <button type="button" data-action="zoomFit" title={tip(t("studio.zoomFit"), "zoomFit")} onclick={() => run("zoomFit")}>{t("studio.zoomFit")}</button>
  </div>
  <div class="group" role="group" aria-label={t("studio.view")}>
    {#each TOGGLES as toggle (toggle.key)}
      <button
        type="button"
        data-toggle={toggle.key}
        aria-pressed={studio.overlays[toggle.key]}
        title={tip(t(toggle.label), toggle.action)}
        onclick={() => run(toggle.action)}>{t(toggle.label)}</button
      >
    {/each}
  </div>
  <div class="group end">
    <button type="button" data-action="help" title={tip(t("studio.shortcuts"), "help")} onclick={() => run("help")}>{t("studio.shortcuts")}</button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.375rem 0.5rem;
    border-block-end: 1px solid var(--sl-color-gray-5);
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .group {
    display: flex;
    gap: 0.25rem;
    flex: none;
  }
  .end {
    margin-inline-start: auto;
  }
  .zoom {
    min-width: 4rem;
    font-variant-numeric: tabular-nums;
  }
</style>
