<script setup>
import { nextTick, ref, watch } from 'vue'
import { ScrollTextIcon } from '@lucide/vue'

const store = useZtudioStore()
const box = ref(null)

watch(
  () => store.logEntries.length,
  async () => {
    await nextTick()
    if (box.value) {
      box.value.scrollTop = box.value.scrollHeight
    }
  },
)
</script>

<template>
  <div class="flex flex-col min-h-0">
    <h2
      class="shrink-0 flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] uppercase text-muted-foreground border-b border-border"
    >
      <ScrollTextIcon class="size-3.5 text-brand" />
      {{ $t('activity.heading') }}
    </h2>
    <div
      ref="box"
      class="flex-1 min-h-0 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap"
    >
      <div v-for="(line, i) in store.logEntries" :key="i">{{ line }}</div>
    </div>
  </div>
</template>
