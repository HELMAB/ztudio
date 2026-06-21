<script setup>
import { nextTick, ref, watch } from 'vue'
import { ActivityIcon, ChevronDownIcon } from '@lucide/vue'

const store = useZtudioStore()
const box = ref(null)
// Collapsed by default — it's a diagnostic panel, opened on demand.
const collapsed = ref(true)

watch(
  () => store.logEntries.length,
  async () => {
    if (collapsed.value) {
      return
    }
    await nextTick()
    if (box.value) {
      box.value.scrollTop = box.value.scrollHeight
    }
  },
)

async function toggle() {
  collapsed.value = !collapsed.value
  if (!collapsed.value) {
    await nextTick()
    if (box.value) {
      box.value.scrollTop = box.value.scrollHeight
    }
  }
}
</script>

<template>
  <div class="flex flex-col min-h-0" :class="collapsed ? '!h-auto !flex-none lg:mt-auto' : ''">
    <button
      type="button"
      class="shrink-0 flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] uppercase text-muted-foreground border-b border-border hover:text-foreground"
      :aria-expanded="!collapsed"
      @click="toggle"
    >
      <ActivityIcon class="size-3.5 text-brand" />
      {{ $t('activity.heading') }}
      <span v-if="store.logEntries.length" class="tabular-nums text-muted-foreground/70">
        ({{ store.logEntries.length }})
      </span>
      <ChevronDownIcon
        class="ml-auto size-3.5 transition-transform"
        :class="collapsed ? '-rotate-90' : ''"
      />
    </button>
    <div
      v-show="!collapsed"
      ref="box"
      class="flex-1 min-h-0 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap"
    >
      <div v-for="(line, i) in store.logEntries" :key="i">{{ line }}</div>
    </div>
  </div>
</template>
