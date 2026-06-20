<script setup>
defineProps({
  icon: { type: [Object, Function], default: null },
})
</script>

<template>
  <h2 class="flex items-center gap-2 font-mono text-[11px] uppercase text-muted-foreground mb-6">
    <component :is="icon" v-if="icon" class="size-3.5 text-[#00b140]" aria-hidden="true" />
    <slot />
  </h2>
</template>
