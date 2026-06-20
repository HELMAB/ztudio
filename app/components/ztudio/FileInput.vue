<script setup>
defineProps({
  label: { type: String, default: '' },
  accept: { type: String, default: '' },
})
defineEmits(['select'])
</script>

<template>
  <ZtudioField :label="label">
    <input
      type="file"
      :accept="accept"
      class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:border file:border-border file:bg-background file:px-3 file:py-1 file:text-[11px] file:font-mono file:uppercase file:text-foreground"
      @change="$emit('select', $event)"
    />
  </ZtudioField>
</template>
