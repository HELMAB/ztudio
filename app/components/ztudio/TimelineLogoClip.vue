<script setup>
import { computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  start: { type: Number, required: true },
  end: { type: Number, required: true },
  pxPerSecond: { type: Number, required: true },
})

const store = useZtudioStore()
const { t } = useI18n()
const MIN = 0.3

function onContextMenu(event) {
  store.openContextMenu(event, [
    { label: t('ctx.delete'), danger: true, action: () => store.loadLogo(null) },
  ])
}

let mode = null
let startX = 0
let origStart = 0
let origEnd = 0

const left = computed(() => props.start * props.pxPerSecond)
const width = computed(() => (props.end - props.start) * props.pxPerSecond)

function onMove(event) {
  if (!mode) {
    return
  }
  const dt = (event.clientX - startX) / props.pxPerSecond
  const snap = {
    pxPerSecond: props.pxPerSecond,
    exclude: [origStart, origEnd],
    disabled: event.altKey,
  }
  if (mode === 'move') {
    const dur = origEnd - origStart
    const s = Math.max(0, store.snapClip(origStart + dt, dur, snap))
    store.setLogoTime(s, s + dur)
  } else if (mode === 'left') {
    const s = Math.min(Math.max(0, store.snapEdge(origStart + dt, snap)), origEnd - MIN)
    store.setLogoTime(s, origEnd)
  } else if (mode === 'right') {
    const e = Math.max(store.snapEdge(origEnd + dt, snap), origStart + MIN)
    store.setLogoTime(origStart, e)
  }
}

function onUp() {
  mode = null
  store.clearSnap()
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
}

function begin(nextMode, event) {
  event.stopPropagation()
  // Grabbing the clip focuses the logo layer (preview gizmo + Image-tab controls).
  store.selectLogo()
  mode = nextMode
  startX = event.clientX
  origStart = props.start
  origEnd = props.end
  store.pause()
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

onBeforeUnmount(onUp)
</script>

<template>
  <div
    class="absolute inset-y-1 flex items-center overflow-hidden rounded border border-fuchsia-500/60 bg-fuchsia-500/20"
    :style="{ left: left + 'px', width: width + 'px' }"
    @contextmenu="onContextMenu"
  >
    <div
      class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-fuchsia-500/50 hover:bg-fuchsia-500"
      @pointerdown="begin('left', $event)"
    />
    <div
      data-testid="logo-clip"
      class="flex-1 h-full flex items-center px-2.5 overflow-hidden cursor-grab active:cursor-grabbing"
      @pointerdown="begin('move', $event)"
    >
      <span class="font-mono text-[10px] text-fuchsia-700 truncate select-none">
        {{ store.logoName }}
      </span>
    </div>
    <div
      class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-fuchsia-500/50 hover:bg-fuchsia-500"
      @pointerdown="begin('right', $event)"
    />
  </div>
</template>
