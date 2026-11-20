<script lang="ts">
  import type { StudioKey, Translate } from "../i18n.ts";
  import { ACTIONS, DEFAULT_BINDINGS, comboOf, displayCombo, rebind, type Action, type Bindings } from "../shortcuts.ts";

  interface Props {
    t: Translate;
    bindings: Bindings;
    apple: boolean;
    onchange: (bindings: Bindings) => void;
  }
  let { t, bindings, apple, onchange }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let capturing = $state<Action | undefined>();
  /** True while the dialog is open or capturing, so global shortcuts stay quiet. */
  export function isOpen(): boolean {
    return dialog?.open ?? false;
  }
  export function open(): void {
    dialog?.showModal();
  }

  function capture(e: KeyboardEvent): void {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      capturing = undefined;
      return;
    }
    const combo = comboOf(e, apple);
    if (!combo) return;
    onchange(rebind(bindings, capturing, combo));
    capturing = undefined;
  }

  const label = (a: Action) => t(`studio.action.${a}` as StudioKey);
</script>

<dialog
  bind:this={dialog}
  class="shortcuts"
  aria-labelledby="studio-keys-h"
  onkeydowncapture={capture}
  onclose={() => (capturing = undefined)}
>
  <header>
    <h2 id="studio-keys-h">{t("studio.keys.title")}</h2>
    <button type="button" onclick={() => dialog?.close()}>{t("studio.keys.close")}</button>
  </header>
  <p>{t("studio.keys.intro")}</p>
  <p class="status" role="status">{capturing ? t("studio.keys.press") : ""}</p>
  <table>
    <thead>
      <tr><th scope="col">{t("studio.keys.action")}</th><th scope="col">{t("studio.keys.keys")}</th><th></th></tr>
    </thead>
    <tbody>
      {#each ACTIONS as a (a)}
        <tr data-action={a}>
          <th scope="row">{label(a)}</th>
          <td dir="ltr">
            {#if bindings[a].length === 0}
              <span class="none">{t("studio.keys.none")}</span>
            {:else}
              {#each bindings[a] as combo (combo)}<kbd>{displayCombo(combo, apple)}</kbd> {/each}
            {/if}
          </td>
          <td>
            <button
              type="button"
              aria-pressed={capturing === a}
              aria-label={t("studio.keys.changeFor", { action: label(a) })}
              onclick={() => (capturing = capturing === a ? undefined : a)}
            >{capturing === a ? "…" : t("studio.keys.change")}</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <footer>
    <button type="button" onclick={() => onchange(DEFAULT_BINDINGS)}>{t("studio.keys.restore")}</button>
  </footer>
</dialog>

<style>
  .shortcuts {
    /* Starlight's reset sets `margin: 0`, which would pin a modal dialog to the corner. */
    margin: auto;
    max-width: min(40rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 1rem 1.25rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.75rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-white);
  }
  .shortcuts::backdrop {
    background: rgb(0 0 0 / 0.5);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  h2 {
    margin: 0;
    font-size: var(--sl-text-h4);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sl-text-sm);
  }
  th,
  td {
    text-align: start;
    padding: 0.25rem 0.5rem;
    border-block-end: 1px solid var(--sl-color-gray-6);
  }
  kbd {
    font-family: var(--__sl-font-mono, monospace);
    border: 1px solid var(--sl-color-gray-4);
    border-radius: 0.25rem;
    padding: 0 0.3rem;
  }
  .none {
    color: var(--sl-color-gray-3);
  }
  .status {
    min-height: 1.5em;
    margin: 0.25rem 0;
    font-weight: 600;
  }
  footer {
    margin-top: 0.75rem;
  }
</style>
