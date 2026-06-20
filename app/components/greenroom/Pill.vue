<script setup>
defineProps({
  ok: { type: Boolean, default: false },
})
</script>

<template>
  <Badge
    variant="outline"
    :class="[
      'rounded-none font-mono text-[11px] uppercase tracking-[0.08em] px-2.5 py-1.5',
      ok ? 'text-[#00b140] border-[#00b140]' : 'text-muted-foreground',
    ]"
  >
    <slot />
  </Badge>
</template>
