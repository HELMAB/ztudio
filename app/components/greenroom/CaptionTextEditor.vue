<script setup>
import { computed } from 'vue'
import { PlusIcon, Trash2Icon } from '@lucide/vue'

const store = useGreenroomStore()

const index = computed(() => store.selectedCueIndex)
const selected = computed(() => (index.value != null ? store.cues[index.value] : null))

function fmt(s) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}
</script>

<template>
  <div class="space-y-2.5">
    <div class="flex items-center justify-between">
      <span class="font-mono text-[11px] uppercase text-muted-foreground">Caption text</span>
      <div class="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          class="size-6"
          aria-label="Add caption"
          @click="store.addCue()"
        >
          <PlusIcon class="size-3.5" />
        </Button>
        <Button
          v-if="selected"
          size="icon"
          variant="ghost"
          class="size-6 text-red-600 hover:text-red-700"
          aria-label="Delete caption"
          @click="store.removeCue(index)"
        >
          <Trash2Icon class="size-3.5" />
        </Button>
      </div>
    </div>

    <template v-if="selected">
      <Textarea
        :model-value="selected.text"
        rows="3"
        placeholder="Type caption…"
        @update:model-value="store.setCueText(index, $event)"
      />
      <p class="font-mono text-[10px] text-muted-foreground">
        {{ fmt(selected.start) }} – {{ fmt(selected.end) }} · press Enter for a new line
      </p>
    </template>
    <p v-else class="text-xs text-muted-foreground">
      Select a caption in the timeline to edit its text, or add a new one.
    </p>
  </div>
</template>
