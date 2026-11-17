<script setup lang="ts">
import { DeqIcon, KurdishSun, RojHalfSun } from "@0xdolan/deq-vue";
</script>

<template>
  <main>
    <h1>Deq + Vue</h1>
    <RojHalfSun />
    <KurdishSun :size="48" color="#ED2024" :stroke-width="1.5" />
    <DeqIcon name="roj-half-sun" size="3em" title="" />
  </main>
</template>
