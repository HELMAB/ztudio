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
const MIN = 0.5

let mode = null
let startX = 0
let origStart = 0
let origEnd = 0

const left = computed(() => props.start * props.pxPerSecond)
const width = computed(() => (props.end - props.start) * props.pxPerSecond)
const isSelected = computed(() => store.selectedImageId === props.id)

function onMove(event) {
  if (!mode) {
    return
  }
  const dt = (event.clientX - startX) / props.pxPerSecond
  if (mode === 'move') {
    const dur = origEnd - origStart
    const s = Math.max(0, origStart + dt)
    store.updateImageTime(props.id, s, s + dur)
  } else if (mode === 'left') {
    const s = Math.min(Math.max(0, origStart + dt), origEnd - MIN)
    store.updateImageTime(props.id, s, origEnd)
  } else if (mode === 'right') {
    store.updateImageTime(props.id, origStart, Math.max(origEnd + dt, origStart + MIN))
  }
}

function onUp() {
  mode = null
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
}

function begin(nextMode, event) {
  event.stopPropagation()
  store.selectImage(props.id)
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
  >
    <div
      class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-sky-500/50 hover:bg-sky-500"
      @pointerdown="begin('left', $event)"
    />
    <div
      class="flex-1 h-full flex items-center gap-1 px-2.5 overflow-hidden cursor-grab active:cursor-grabbing"
      @pointerdown="begin('move', $event)"
    >
      <span class="font-mono text-[10px] text-sky-700 truncate select-none">{{ label }}</span>
    </div>
    <button
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded bg-sky-500/30 px-1 text-[10px] text-sky-700 hover:bg-sky-500/60"
      :title="$t('image.remove')"
      @pointerdown.stop
      @click.stop="store.removeImage(props.id)"
    >
      ✕
    </button>
    <div
      class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-sky-500/50 hover:bg-sky-500"
      @pointerdown="begin('right', $event)"
    />
  </div>
</template>
