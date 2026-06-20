<script setup>
import { ref } from 'vue'
import { GalleryHorizontalEndIcon, TypeIcon, UploadIcon } from '@lucide/vue'

// Sections that live in side panels on desktop become swappable tabs here.
const TABS = [
  { id: 'media', icon: UploadIcon, labelKey: 'nav.media' },
  { id: 'caption', icon: TypeIcon, labelKey: 'nav.caption' },
  { id: 'timeline', icon: GalleryHorizontalEndIcon, labelKey: 'nav.timeline' },
]

const tab = ref('media')
</script>

<template>
  <div class="flex flex-1 min-h-0 flex-col">
    <!-- Preview stays pinned above the panels so edits stay visible while scrubbing. -->
    <ZtudioPreviewStage class="h-[38dvh] shrink-0 border-b border-border" />

    <div class="flex flex-1 min-h-0 flex-col">
      <!-- Panels are kept mounted (v-show) so scroll position, zoom and log survive tab switches. -->
      <div class="min-h-0 flex-1">
        <ZtudioMediaPanel v-show="tab === 'media'" class="h-full" />
        <ZtudioInspectorPanel v-show="tab === 'caption'" class="h-full" />
        <ZtudioTimeline v-show="tab === 'timeline'" class="h-full" />
      </div>

      <nav class="grid shrink-0 grid-cols-3 border-t border-border bg-background">
        <button
          v-for="item in TABS"
          :key="item.id"
          type="button"
          class="flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 px-2 transition-colors"
          :class="
            tab === item.id
              ? 'border-brand text-brand'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          :aria-current="tab === item.id ? 'page' : undefined"
          @click="tab = item.id"
        >
          <component :is="item.icon" class="size-5" />
          <span class="text-[11px] font-medium">{{ $t(item.labelKey) }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>
