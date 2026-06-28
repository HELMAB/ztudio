<script setup>
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'

const store = useZtudioStore()

// Drag a panel divider. `axis` picks the pointer coordinate, `key` the layout
// dimension, and `sign` whether moving toward +coord grows (right/bottom handle,
// +1) or shrinks (left/top handle, -1) the panel. Live updates don't persist;
// the final size is committed on release.
function startResize(event, axis, key, sign) {
  event.preventDefault()
  const startPos = axis === 'x' ? event.clientX : event.clientY
  const startVal = store.layout[key]
  const onMove = ev => {
    const pos = axis === 'x' ? ev.clientX : ev.clientY
    store.setPanelSize(key, startVal + (pos - startPos) * sign)
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    store.saveLayout()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
</script>

<template>
  <div class="flex flex-1 min-h-0 flex-col">
    <div class="flex flex-1 min-h-0">
      <!-- Media panel: rail when collapsed, sized + resizable when open. -->
      <button
        v-if="!store.layout.mediaOpen"
        type="button"
        class="w-6 shrink-0 flex items-center justify-center border-r border-border bg-card/40 text-muted-foreground hover:bg-muted hover:text-foreground"
        :aria-label="$t('layout.showMedia')"
        :title="$t('layout.showMedia')"
        data-testid="media-expand"
        @click="store.toggleMediaPanel()"
      >
        <ChevronRightIcon class="size-4" />
      </button>
      <template v-else>
        <ZtudioMediaPanel
          class="shrink-0 border-r border-border"
          :style="{ width: store.layout.mediaWidth + 'px' }"
        />
        <div
          class="group relative w-1.5 shrink-0 cursor-col-resize touch-none bg-border/40 hover:bg-brand/60"
          data-testid="resize-media"
          :title="$t('layout.resizeHint')"
          @pointerdown="startResize($event, 'x', 'mediaWidth', 1)"
          @dblclick="store.toggleMediaPanel()"
        />
      </template>

      <ZtudioPreviewStage class="flex-1 min-w-0" />

      <!-- Inspector panel: handle on its left edge (so dragging left grows it). -->
      <template v-if="store.layout.inspectorOpen">
        <div
          class="group relative w-1.5 shrink-0 cursor-col-resize touch-none bg-border/40 hover:bg-brand/60"
          data-testid="resize-inspector"
          :title="$t('layout.resizeHint')"
          @pointerdown="startResize($event, 'x', 'inspectorWidth', -1)"
          @dblclick="store.toggleInspectorPanel()"
        />
        <ZtudioInspectorPanel
          class="shrink-0 border-l border-border"
          :style="{ width: store.layout.inspectorWidth + 'px' }"
        />
      </template>
      <button
        v-else
        type="button"
        class="w-6 shrink-0 flex items-center justify-center border-l border-border bg-card/40 text-muted-foreground hover:bg-muted hover:text-foreground"
        :aria-label="$t('layout.showInspector')"
        :title="$t('layout.showInspector')"
        data-testid="inspector-expand"
        @click="store.toggleInspectorPanel()"
      >
        <ChevronLeftIcon class="size-4" />
      </button>
    </div>

    <!-- Timeline: drag the top edge to grow/shrink its height. -->
    <div
      class="h-1.5 shrink-0 cursor-row-resize touch-none border-t border-border bg-border/40 hover:bg-brand/60"
      data-testid="resize-timeline"
      :title="$t('layout.resizeHint')"
      @pointerdown="startResize($event, 'y', 'timelineHeight', -1)"
    />
    <ZtudioTimeline class="shrink-0" :style="{ height: store.layout.timelineHeight + 'px' }" />
  </div>
</template>
