<script setup>
import { ref } from 'vue'
import { GalleryHorizontalEndIcon, TypeIcon, UploadIcon } from '@lucide/vue'

// Sections that live in side panels on desktop become swappable tabs here.
const TABS = [
  { id: 'media', icon: UploadIcon, labelKey: 'nav.media' },
  { id: 'caption', icon: TypeIcon, labelKey: 'nav.caption' },
  { id: 'timeline', icon: GalleryHorizontalEndIcon, labelKey: 'nav.timeline' },
]

// On mobile the panels collapse into a bottom sheet so the preview can own the
// whole screen by default. `null` means collapsed; tapping a tab opens it, and
// tapping the active tab again closes it back to the maximised preview.
const openTab = ref(null)

function toggleTab(id) {
  openTab.value = openTab.value === id ? null : id
}
</script>

<template>
  <div class="flex flex-1 min-h-0 flex-col">
    <!-- Preview is the hero: with the sheet collapsed it fills everything above the
         tab bar, so the 9:16 canvas grows until it spans the screen width. -->
    <ZtudioPreviewStage class="flex-1 min-h-0 border-b border-border" />

    <!-- Bottom sheet. Only claims height when a tab is open; panels stay mounted
         (v-show) so scroll position, zoom and the log survive open/close + switches. -->
    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      leave-active-class="transition-transform duration-150 ease-in"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div v-show="openTab" class="h-[42dvh] shrink-0 overflow-hidden border-b border-border">
        <ZtudioMediaPanel v-show="openTab === 'media'" class="h-full" />
        <ZtudioInspectorPanel v-show="openTab === 'caption'" class="h-full" />
        <ZtudioTimeline v-show="openTab === 'timeline'" class="h-full" />
      </div>
    </Transition>

    <nav
      class="grid shrink-0 grid-cols-3 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <button
        v-for="item in TABS"
        :key="item.id"
        type="button"
        class="flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 px-2 transition-colors"
        :class="
          openTab === item.id
            ? 'border-brand text-brand'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        :aria-expanded="openTab === item.id"
        @click="toggleTab(item.id)"
      >
        <component :is="item.icon" class="size-5" />
        <span class="text-[11px] font-medium">{{ $t(item.labelKey) }}</span>
      </button>
    </nav>
  </div>
</template>
