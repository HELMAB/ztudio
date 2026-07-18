<script setup>
import { computed } from 'vue'
import {
  CaptionsIcon,
  CheckIcon,
  ImageIcon,
  MinusIcon,
  Music2Icon,
  MusicIcon,
  StampIcon,
} from '@lucide/vue'

// Project readiness as a status list: one row per input slot, green check when
// loaded. The optional music row appears only once a bed is added, so the list
// stays focused on the core inputs.
const store = useZtudioStore()

const rows = computed(() => [
  { icon: MusicIcon, pill: store.audioPill },
  ...(store.hasMusic ? [{ icon: Music2Icon, pill: store.musicPill }] : []),
  { icon: ImageIcon, pill: store.imagePill },
  { icon: CaptionsIcon, pill: store.srtPill },
  { icon: StampIcon, pill: store.logoPill },
])
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border divide-y divide-border">
    <div v-for="(r, i) in rows" :key="i" class="flex items-center gap-2.5 px-3 py-2">
      <component
        :is="r.icon"
        class="size-3.5 shrink-0"
        :class="r.pill.ok ? 'text-brand' : 'text-muted-foreground/60'"
      />
      <span
        class="min-w-0 truncate text-xs"
        :class="r.pill.ok ? 'text-foreground' : 'text-muted-foreground'"
      >
        {{ r.pill.text }}
      </span>
      <CheckIcon v-if="r.pill.ok" class="ml-auto size-3.5 shrink-0 text-brand" />
      <MinusIcon v-else class="ml-auto size-3.5 shrink-0 text-muted-foreground/40" />
    </div>
  </div>
</template>
