<script setup>
defineProps({
  ok: { type: Boolean, default: false },
})
</script>

<template>
  <Badge
    variant="outline"
    :class="[
      'rounded-none font-mono text-[11px] uppercase px-2.5 py-1.5',
      ok ? 'text-brand border-brand' : 'text-muted-foreground',
    ]"
  >
    <slot />
  </Badge>
</template>
