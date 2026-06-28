<script setup>
import { computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  id: { type: Number, required: true },
  start: { type: Number, required: true },
  end: { type: Number, required: true },
  label: { type: String, default: '' },
  pxPerSecond: { type: Number, required: true },
})

const store = useZtudioStore()
const { t } = useI18n()
const MIN = 0.3

function onContextMenu(event) {
  store.selectText(props.id)
  store.openContextMenu(event, [
    { label: t('ctx.delete'), danger: true, action: () => store.removeText(props.id) },
  ])
}

let mode = null
let startX = 0
let origStart = 0
let origEnd = 0

const left = computed(() => props.start * props.pxPerSecond)
const width = computed(() => (props.end - props.start) * props.pxPerSecond)
const isSelected = computed(() => store.selectedTextId === props.id)

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
    store.updateTextTime(props.id, s, s + dur)
  } else if (mode === 'left') {
    const s = Math.min(Math.max(0, store.snapEdge(origStart + dt, snap)), origEnd - MIN)
    store.updateTextTime(props.id, s, origEnd)
  } else if (mode === 'right') {
    const e = Math.max(store.snapEdge(origEnd + dt, snap), origStart + MIN)
    store.updateTextTime(props.id, origStart, e)
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
  store.selectText(props.id)
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
    class="absolute inset-y-1 flex items-center overflow-hidden rounded border bg-sky-500/20"
    :class="isSelected ? 'border-sky-600 ring-2 ring-sky-500 z-10' : 'border-sky-500/60'"
    :style="{ left: left + 'px', width: width + 'px' }"
    @contextmenu="onContextMenu"
  >
    <div
      class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-sky-500/50 hover:bg-sky-500"
      @pointerdown="begin('left', $event)"
    />
    <div
      class="flex-1 h-full flex items-center px-2.5 overflow-hidden cursor-grab active:cursor-grabbing"
      @pointerdown="begin('move', $event)"
    >
      <span class="font-mono text-[10px] text-sky-700 truncate select-none">{{ label }}</span>
    </div>
    <div
      class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-sky-500/50 hover:bg-sky-500"
      @pointerdown="begin('right', $event)"
    />
  </div>
</template>
