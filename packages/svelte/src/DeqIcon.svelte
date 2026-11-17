<!--
  @component
  Any icon by catalog id: `<DeqIcon name="roj-half-sun" />`. It keeps every icon in the
  bundle; import the named components (`RojHalfSun`) to tree-shake. Throws a `DeqError`
  (`UNKNOWN_SHAPE`) for an id that is not in the catalog.
-->
<script lang="ts">
  import { DeqError } from "@0xdolan/deq-core";
  import { icons } from "@0xdolan/deq-icons";

  import Icon from "./Icon.svelte";
  import type { DeqIconByNameProps } from "./types.js";

  let { name, ...props }: DeqIconByNameProps = $props();

  const icon = $derived.by(() => {
    const found = Object.hasOwn(icons, name) ? icons[name] : undefined;
    if (!found) throw new DeqError("UNKNOWN_SHAPE", `unknown icon: ${name}`);
    return found;
  });
</script>

<Icon {icon} {...props} />
