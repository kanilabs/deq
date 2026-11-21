<script lang="ts">
  import type { SceneStyle } from "../generate.ts";
  import type { Translate } from "../i18n.ts";

  interface Props {
    style: SceneStyle;
    t: Translate;
    /** Prefix for element ids, so two panels on one page do not clash. */
    id: string;
    /** The Studio sets the background per item, so it hides that field. */
    background?: boolean;
  }
  let { style = $bindable(), t, id, background = true }: Props = $props();

  const set = <K extends keyof SceneStyle>(key: K, value: SceneStyle[K]) => {
    style = { ...style, [key]: value };
  };
  const num = (e: Event, min: number, max: number, fallback: number) => {
    const n = (e.currentTarget as HTMLInputElement).valueAsNumber;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
</script>

<fieldset class="scene-style">
  <legend>{t("studio.scene.style")}</legend>
  <label class="field" for={`${id}-size`}>
    {t("studio.scene.size")}
    <input id={`${id}-size`} type="number" min="8" max="512" step="1" value={style.size}
      onchange={(e) => set("size", num(e, 8, 512, style.size))} />
  </label>
  <label class="field" for={`${id}-stroke`}>
    {t("studio.scene.strokeWidth")}
    <input id={`${id}-stroke`} type="range" min="0.5" max="4" step="0.25" value={style.strokeWidth}
      oninput={(e) => set("strokeWidth", num(e, 0.5, 4, style.strokeWidth))} />
  </label>
  <label class="field" for={`${id}-colors`}>
    {t("studio.scene.colors")}
    <select id={`${id}-colors`} value={style.colorMode}
      onchange={(e) => set("colorMode", e.currentTarget.value as SceneStyle["colorMode"])}>
      <option value="theme">{t("studio.scene.colors.theme")}</option>
      <option value="custom">{t("studio.scene.colors.custom")}</option>
      <option value="flag">{t("studio.scene.colors.flag")}</option>
    </select>
  </label>
  {#if style.colorMode === "custom"}
    <label class="field" for={`${id}-color`}>
      {t("studio.scene.color")}
      <input id={`${id}-color`} type="color" value={style.color}
        oninput={(e) => set("color", e.currentTarget.value)} />
    </label>
  {/if}
  {#if background}
    <label class="check">
      <input type="checkbox" checked={style.background !== ""}
        onchange={(e) => set("background", e.currentTarget.checked ? "#ffffff" : "")} />
      {t("studio.scene.background")}
    </label>
    {#if style.background}
      <input type="color" aria-label={t("studio.scene.background")} value={style.background}
        oninput={(e) => set("background", e.currentTarget.value)} />
    {/if}
  {/if}
</fieldset>
