<script setup>
import { computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  index: { type: Number, required: true },
  start: { type: Number, required: true },
  end: { type: Number, required: true },
  label: { type: String, default: '' },
  pxPerSecond: { type: Number, required: true },
})

const store = useZtudioStore()
const MIN = 0.1

let mode = null
let startX = 0
let origStart = 0
let origEnd = 0

const left = computed(() => props.start * props.pxPerSecond)
const width = computed(() => (props.end - props.start) * props.pxPerSecond)
const isSelected = computed(() => store.selectedCueIndex === props.index)

function onMove(event) {
  if (!mode) {
    return
  }
  const dt = (event.clientX - startX) / props.pxPerSecond
  if (mode === 'move') {
    const dur = origEnd - origStart
    const s = Math.max(0, origStart + dt)
    store.updateCue(props.index, s, s + dur)
  } else if (mode === 'left') {
    const s = Math.min(Math.max(0, origStart + dt), origEnd - MIN)
    store.updateCue(props.index, s, origEnd)
  } else if (mode === 'right') {
    store.updateCue(props.index, origStart, Math.max(origEnd + dt, origStart + MIN))
  }
}

function onUp() {
  mode = null
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
}

function begin(nextMode, event) {
  event.stopPropagation()
  store.selectCue(props.index)
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
    class="absolute inset-y-1 flex items-center overflow-hidden rounded border bg-amber-500/20"
    :class="isSelected ? 'border-amber-600 ring-2 ring-amber-500 z-10' : 'border-amber-500/60'"
    :style="{ left: left + 'px', width: width + 'px' }"
    :title="$t('caption.editHint')"
    @dblclick="store.openEditCaption(index)"
  >
    <div
      class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-amber-500/50 hover:bg-amber-500"
      @pointerdown="begin('left', $event)"
    />
    <div
      class="flex-1 h-full flex items-center px-2.5 overflow-hidden cursor-grab active:cursor-grabbing"
      @pointerdown="begin('move', $event)"
    >
      <span class="font-mono text-[10px] text-amber-700 truncate select-none">{{ label }}</span>
    </div>
    <div
      class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-amber-500/50 hover:bg-amber-500"
      @pointerdown="begin('right', $event)"
    />
  </div>
</template>
