<script setup>
defineProps({
  label: { type: String, default: '' },
  value: { type: String, default: '' },
})
</script>

<template>
  <div>
    <label class="block font-mono text-[11px] uppercase text-muted-foreground mb-2">
      {{ label }}
      <span v-if="value" class="float-right text-foreground normal-case">{{ value }}</span>
    </label>
    <slot />
  </div>
</template>
