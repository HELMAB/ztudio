<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { PlusIcon, Trash2Icon } from '@lucide/vue'

const store = useZtudioStore()

// Cues in chronological order, carrying their original array index so edits and
// deletes hit the right entry regardless of display order (SRT order may differ).
const rows = computed(() =>
  store.cues
    .map((cue, index) => ({ cue, index }))
    .sort((a, b) => a.cue.start - b.cue.start),
)

// The cue playing at the current scrub time — drives the live row highlight and
// auto-scroll during playback.
const activeIndex = computed(() =>
  store.cues.findIndex(c => store.scrub >= c.start && store.scrub < c.end),
)

const fmt = s => {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}

// Keep the live cue visible while playing without yanking the list when the user
// is scrolling/editing manually.
const listEl = ref(null)
watch(activeIndex, i => {
  if (i < 0 || !store.isPlaying || !listEl.value) {
    return
  }
  nextTick(() => {
    listEl.value?.querySelector(`[data-cue="${i}"]`)?.scrollIntoView({ block: 'nearest' })
  })
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex shrink-0 items-center justify-between">
      <span class="font-mono text-[11px] uppercase text-muted-foreground">
        {{ $t('caption.listHeading') }}
        <span v-if="rows.length" class="ml-1 text-muted-foreground/60">{{ rows.length }}</span>
      </span>
      <Button size="sm" variant="outline" class="gap-1.5" @click="store.openAddCaption()">
        <PlusIcon class="size-3.5" />
        {{ $t('caption.add') }}
      </Button>
    </div>

    <div v-if="rows.length" ref="listEl" class="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
      <div
        v-for="{ cue, index } in rows"
        :key="index"
        :data-cue="index"
        class="group rounded-md border transition-colors"
        :class="
          index === store.selectedCueIndex
            ? 'border-brand/50 bg-brand/10'
            : index === activeIndex
              ? 'border-brand/40 bg-brand/5'
              : 'border-border hover:bg-muted/40'
        "
        @click="store.goToCue(index)"
      >
        <div class="flex items-center gap-2 px-2 pt-1.5">
          <span class="font-mono text-[10px] tabular-nums text-muted-foreground/70">
            {{ index + 1 }}
          </span>
          <span
            class="font-mono text-[10px] tabular-nums"
            :class="index === activeIndex ? 'text-brand' : 'text-muted-foreground'"
          >
            {{ fmt(cue.start) }} – {{ fmt(cue.end) }}
          </span>
          <button
            type="button"
            class="ml-auto shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            :aria-label="$t('caption.deleteAria')"
            @click.stop="store.removeCue(index)"
          >
            <Trash2Icon class="size-3.5" />
          </button>
        </div>
        <textarea
          :value="cue.text"
          :rows="index === store.selectedCueIndex ? 2 : 1"
          class="w-full resize-none bg-transparent px-2 pb-1.5 pt-0.5 text-sm leading-snug outline-none"
          :placeholder="$t('caption.placeholder')"
          @click.stop
          @focus="store.goToCue(index)"
          @input="store.setCueText(index, $event.target.value)"
        />
      </div>
    </div>

    <p v-else class="text-xs text-muted-foreground">{{ $t('caption.listEmpty') }}</p>
  </div>
</template>
