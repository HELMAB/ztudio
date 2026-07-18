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
const MIN = 0.5

// Filmstrip preview: the clip's bitmap reduced to a small strip tile, repeated
// horizontally across the clip. Cached per bitmap (data URL), so duplicates and
// splits that share a bitmap reuse the same tile.
const THUMB_H = 64
const thumbCache = new WeakMap()
function thumbFor(bitmap) {
  if (!bitmap) {
    return ''
  }
  let url = thumbCache.get(bitmap)
  if (!url) {
    const tw = Math.max(1, Math.round((THUMB_H * bitmap.width) / bitmap.height))
    const cv = document.createElement('canvas')
    cv.width = tw
    cv.height = THUMB_H
    cv.getContext('2d').drawImage(bitmap, 0, 0, tw, THUMB_H)
    url = cv.toDataURL('image/jpeg', 0.7)
    thumbCache.set(bitmap, url)
  }
  return url
}
const thumbUrl = computed(() => thumbFor(store.images.find(im => im.id === props.id)?.bitmap))

function onContextMenu(event) {
  store.selectImage(props.id)
  store.openContextMenu(event, [
    { label: t('ctx.split'), action: () => store.splitImageAt(props.id) },
    { label: t('ctx.duplicate'), action: () => store.duplicateImage(props.id) },
    { label: t('ctx.resetFraming'), action: () => store.resetImageTransform() },
    { separator: true },
    { label: t('ctx.delete'), danger: true, action: () => store.removeImage(props.id) },
  ])
}

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
  const snap = {
    pxPerSecond: props.pxPerSecond,
    exclude: [origStart, origEnd],
    disabled: event.altKey,
  }
  if (mode === 'move') {
    const dur = origEnd - origStart
    const s = Math.max(0, store.snapClip(origStart + dt, dur, snap))
    store.updateImageTime(props.id, s, s + dur)
  } else if (mode === 'left') {
    const s = Math.min(Math.max(0, store.snapEdge(origStart + dt, snap)), origEnd - MIN)
    store.updateImageTime(props.id, s, origEnd)
  } else if (mode === 'right') {
    const e = Math.max(store.snapEdge(origEnd + dt, snap), origStart + MIN)
    store.updateImageTime(props.id, origStart, e)
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
    @contextmenu="onContextMenu"
  >
    <div
      v-if="thumbUrl"
      class="absolute inset-0 pointer-events-none"
      data-testid="image-clip-thumbs"
      :style="{
        backgroundImage: `url(${thumbUrl})`,
        backgroundSize: 'auto 100%',
        backgroundRepeat: 'repeat-x',
      }"
    />
    <div
      class="absolute left-0 top-0 bottom-0 z-10 w-1.5 cursor-ew-resize bg-sky-500/50 hover:bg-sky-500"
      @pointerdown="begin('left', $event)"
    />
    <div
      class="relative flex-1 h-full flex items-center gap-1 px-2.5 overflow-hidden cursor-grab active:cursor-grabbing"
      data-testid="image-clip"
      @pointerdown="begin('move', $event)"
    >
      <span
        class="max-w-full truncate select-none rounded bg-black/45 px-1 font-mono text-[10px] text-white"
        >{{ label }}</span
      >
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
      class="absolute right-0 top-0 bottom-0 z-10 w-1.5 cursor-ew-resize bg-sky-500/50 hover:bg-sky-500"
      @pointerdown="begin('right', $event)"
    />
  </div>
</template>
