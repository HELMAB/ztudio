<script setup>
import { onMounted, ref, watch } from 'vue'
import { ImageDownIcon, PauseIcon, PlayIcon } from '@lucide/vue'
import { captionCenter, drawFrame } from '@/lib/ztudio/renderer'

const store = useZtudioStore()
const canvas = ref(null)

// Offset (fraction of frame) within which we snap the caption to a centre axis.
const SNAP = 0.012
const dragging = ref(false)

function paint() {
  const el = canvas.value
  if (!el) {
    return
  }
  const { w, h } = store.dimensions
  el.width = w
  el.height = h
  const ctx = el.getContext('2d')
  drawFrame(ctx, w, h, store.scrub, {
    images: store.images,
    cues: store.cues,
    style: store.style,
    keyframes: store.keyframes,
  })
  if (dragging.value) {
    drawGuides(ctx, w, h)
  }
}

// Centre alignment guides, shown only while dragging. A line lights up when the
// active target is centred on that axis. These draw on the preview canvas only —
// the encoder uses its own canvas, so guides never appear in the exported video.
function drawGuides(ctx, w, h) {
  let xCentered
  let yCentered
  if (store.dragTarget === 'image') {
    xCentered = (store.selectedImage?.offsetXPct ?? 0) === 0
    yCentered = (store.selectedImage?.offsetYPct ?? 0) === 0
  } else {
    const c = captionCenter(w, h, store.currentCaption, store.style)
    xCentered = store.controls.offsetXPct === 0
    yCentered = !!c && Math.abs(c.cy - h / 2) < 1
  }
  const lw = Math.max(2, w * 0.0025)

  const line = (active, x1, y1, x2, y2) => {
    ctx.save()
    ctx.lineWidth = lw
    ctx.setLineDash(active ? [] : [lw * 4, lw * 4])
    ctx.strokeStyle = active ? '#ff3d7f' : 'rgba(255,255,255,0.45)'
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.restore()
  }

  line(xCentered, w / 2, 0, w / 2, h)
  line(yCentered, 0, h / 2, w, h / 2)
}

onMounted(() => {
  watch(
    () => [
      store.dimensions,
      store.scrub,
      store.style,
      store.images,
      store.selectedImageId,
      store.cues,
      store.keyframes,
      store.previewTick,
      dragging.value,
    ],
    paint,
    { immediate: true },
  )
})

function fmtTime(s) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}

// Drag to reposition the active target (caption or image) anywhere on the
// preview. Pointer deltas are converted to a fraction of the canvas's displayed
// size, so the offset is resolution-agnostic.
let drag = null

function onPointerDown(e) {
  const el = canvas.value
  if (!el) {
    return
  }
  el.setPointerCapture(e.pointerId)
  const image = store.dragTarget === 'image' && !!store.selectedImage
  drag = {
    startX: e.clientX,
    startY: e.clientY,
    rect: el.getBoundingClientRect(),
    image,
    offX: image ? store.selectedImage.offsetXPct : store.controls.offsetXPct,
    offY: image ? store.selectedImage.offsetYPct : store.controls.offsetYPct,
  }
  dragging.value = true
}

// Offset (fraction of height) that lands the caption block centre on h/2.
function verticalCenterOffset() {
  const text = store.currentCaption
  if (!text) {
    return null
  }
  const { w, h } = store.dimensions
  const base = captionCenter(w, h, text, { ...store.style, offsetXPct: 0, offsetYPct: 0 })
  return 0.5 - base.cy / h
}

function onPointerMove(e) {
  if (!drag) {
    return
  }
  let x = drag.offX + (e.clientX - drag.startX) / drag.rect.width
  let y = drag.offY + (e.clientY - drag.startY) / drag.rect.height

  if (drag.image) {
    if (Math.abs(x) < SNAP) {
      x = 0
    }
    if (Math.abs(y) < SNAP) {
      y = 0
    }
    store.setImageOffset(x, y)
    return
  }

  if (Math.abs(x) < SNAP) {
    x = 0
  }
  const centerY = verticalCenterOffset()
  if (centerY != null && Math.abs(y - centerY) < SNAP) {
    y = centerY
  }
  store.setCaptionOffset(x, y)
}

function onPointerUp(e) {
  const el = canvas.value
  if (el?.hasPointerCapture(e.pointerId)) {
    el.releasePointerCapture(e.pointerId)
  }
  drag = null
  dragging.value = false
}

// Mouse wheel zooms the image when it is the active target.
function onWheel(e) {
  if (store.dragTarget !== 'image' || !store.selectedImage) {
    return
  }
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
  store.setImageZoom(store.selectedImage.zoom * factor)
}

function onResetDrag() {
  if (store.dragTarget === 'image') {
    store.resetImageTransform()
  } else {
    store.resetCaptionOffset()
  }
}
</script>

<template>
  <section class="flex flex-col min-w-0 bg-neutral-900">
    <div class="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6">
      <canvas
        ref="canvas"
        width="1080"
        height="1920"
        class="max-w-full max-h-full object-contain border border-neutral-700 shadow-lg cursor-grab touch-none select-none active:cursor-grabbing"
        :title="store.dragTarget === 'image' ? $t('preview.dragImageHint') : $t('preview.dragHint')"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
        @dblclick="onResetDrag"
      />
    </div>

    <div
      class="shrink-0 flex items-center gap-3 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-3 bg-neutral-950 border-t border-neutral-800"
    >
      <Button
        size="icon"
        variant="secondary"
        class="rounded-full"
        :aria-label="store.isPlaying ? $t('actions.pause') : $t('actions.play')"
        @click="store.togglePlay()"
      >
        <PauseIcon v-if="store.isPlaying" class="size-4" />
        <PlayIcon v-else class="size-4" />
      </Button>
      <span class="font-mono text-xs text-neutral-300 tabular-nums shrink-0">
        {{ fmtTime(store.scrub) }} / {{ fmtTime(store.previewDuration) }}
      </span>
      <span
        v-if="store.hasTrim"
        class="shrink-0 rounded border border-brand/50 bg-brand/15 px-1.5 py-0.5 font-mono text-[10px] text-brand tabular-nums"
        :title="$t('trim.outputHint')"
      >
        {{ $t('trim.output', { duration: store.outputDurationLabel }) }}
      </span>
      <span class="font-mono text-[11px] text-neutral-500 truncate min-w-0">
        {{ store.currentCaption || $t('preview.noCaption') }}
      </span>

      <div
        v-if="store.hasImages"
        class="ml-auto shrink-0 flex rounded-md border border-neutral-700 overflow-hidden text-[11px] font-mono"
        role="group"
        :aria-label="$t('preview.dragTarget')"
      >
        <button
          type="button"
          class="px-2.5 py-1 transition-colors"
          :class="
            store.dragTarget === 'caption'
              ? 'bg-neutral-200 text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-200'
          "
          @click="store.dragTarget = 'caption'"
        >
          {{ $t('preview.targetCaption') }}
        </button>
        <button
          type="button"
          class="px-2.5 py-1 transition-colors"
          :class="
            store.dragTarget === 'image'
              ? 'bg-neutral-200 text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-200'
          "
          @click="store.dragTarget = 'image'"
        >
          {{ $t('preview.targetImage') }}
        </button>
      </div>

      <Button
        size="sm"
        variant="secondary"
        class="shrink-0"
        :class="{ 'ml-auto': !store.hasImages }"
        :disabled="store.busy"
        :title="$t('actions.thumbnailHint')"
        @click="store.exportThumbnail()"
      >
        <ImageDownIcon class="size-4" />
        <span class="hidden sm:inline">{{ $t('actions.thumbnail') }}</span>
      </Button>
    </div>
  </section>
</template>
