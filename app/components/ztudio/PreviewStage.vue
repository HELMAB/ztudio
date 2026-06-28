<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageDownIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SquareDashedIcon,
} from '@lucide/vue'
import { captionCenter, drawFrame } from '@/lib/ztudio/renderer'
import { SAFE_AREA_PCT } from '@/lib/ztudio/config'

const store = useZtudioStore()
const canvas = ref(null)
const stageEl = ref(null)
const isFullscreen = ref(false)
// Title-safe overlay: a preview-only guide, never drawn into the encode.
const showSafeArea = ref(false)

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
    texts: store.texts,
    logo: store.logoResolved,
  })
  if (showSafeArea.value) {
    drawSafeArea(ctx, w, h)
  }
  if (dragging.value) {
    drawGuides(ctx, w, h)
  }
}

// Title-safe margin guide: a dashed inset rectangle marking where captions stay
// clear of frame edges and platform UI. Preview canvas only — the encoder uses
// its own canvas via drawFrame, so this never appears in the exported video.
function drawSafeArea(ctx, w, h) {
  const mx = w * SAFE_AREA_PCT
  const my = h * SAFE_AREA_PCT
  const lw = Math.max(2, w * 0.0025)
  ctx.save()
  ctx.lineWidth = lw
  ctx.setLineDash([lw * 4, lw * 4])
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.strokeRect(mx, my, w - 2 * mx, h - 2 * my)
  ctx.restore()
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

function syncFullscreen() {
  isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement)
}

function toggleFullscreen() {
  const el = stageEl.value
  if (!el) {
    return
  }
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    ;(document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
  } else {
    ;(el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)
  }
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
      showSafeArea.value,
    ],
    paint,
    { immediate: true },
  )
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('webkitfullscreenchange', syncFullscreen)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('webkitfullscreenchange', syncFullscreen)
})

function fmtTime(s) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}

// Click-to-edit current time. Accepts "m:ss(.s)" or plain seconds; commits on
// Enter/blur, cancels on Escape.
const editingTime = ref(false)
const timeInput = ref('')
const timeField = ref(null)

function parseTime(str) {
  const s = str.trim()
  if (!s) {
    return null
  }
  if (s.includes(':')) {
    const [m, sec] = s.split(':')
    const mm = parseFloat(m)
    const ss = parseFloat(sec)
    return Number.isNaN(mm) || Number.isNaN(ss) ? null : mm * 60 + ss
  }
  const v = parseFloat(s)
  return Number.isNaN(v) ? null : v
}

function beginEditTime() {
  store.pause()
  timeInput.value = fmtTime(store.scrub)
  editingTime.value = true
  nextTick(() => timeField.value?.select())
}

function commitTime() {
  if (!editingTime.value) {
    return
  }
  const t = parseTime(timeInput.value)
  if (t != null) {
    store.seek(t)
  }
  editingTime.value = false
}

function cancelTime() {
  editingTime.value = false
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

  // The layer being edited is chosen explicitly via the toolbar Caption/Image
  // toggle (store.dragTarget). For an image drag, sync the selection to the clip
  // on screen so the edit lands on what's visible; with no clip at the playhead
  // there's nothing to move, so the drag is a no-op.
  if (store.dragTarget === 'image') {
    if (!store.activeImage) {
      return
    }
    store.selectImage(store.activeImage.id)
    if (!store.selectedImage) {
      return
    }
  }

  el.setPointerCapture(e.pointerId)
  const image = store.dragTarget === 'image'
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

// Mouse wheel zooms the image visible at the playhead, but only while the Image
// target is selected, so it never fights a caption edit. Selects the on-screen
// clip first so the zoom lands on what's visible.
function onWheel(e) {
  if (store.dragTarget !== 'image') {
    return
  }
  const img = store.activeImage
  if (!img) {
    return
  }
  e.preventDefault()
  store.selectImage(img.id)
  const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
  store.setImageZoom(img.zoom * factor)
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
  <section ref="stageEl" class="flex flex-col min-w-0 bg-neutral-900">
    <div class="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-6">
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
      class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-3 bg-neutral-950 border-t border-neutral-800"
    >
      <div class="flex items-center gap-0.5 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          class="size-7 text-neutral-300"
          :aria-label="$t('transport.start')"
          :title="$t('transport.start')"
          @click="store.seek(0)"
        >
          <SkipBackIcon class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          class="size-7 text-neutral-300"
          :aria-label="$t('transport.prevCaption')"
          :title="$t('transport.prevCaption')"
          @click="store.jumpCue(-1)"
        >
          <ChevronLeftIcon class="size-4" />
        </Button>
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
        <Button
          size="icon"
          variant="ghost"
          class="size-7 text-neutral-300"
          :aria-label="$t('transport.nextCaption')"
          :title="$t('transport.nextCaption')"
          @click="store.jumpCue(1)"
        >
          <ChevronRightIcon class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          class="size-7 text-neutral-300"
          :aria-label="$t('transport.end')"
          :title="$t('transport.end')"
          @click="store.seek(store.previewDuration)"
        >
          <SkipForwardIcon class="size-4" />
        </Button>
      </div>
      <span class="font-mono text-xs text-neutral-300 tabular-nums shrink-0">
        <input
          v-if="editingTime"
          ref="timeField"
          v-model="timeInput"
          type="text"
          inputmode="decimal"
          class="w-14 rounded bg-neutral-800 px-1 py-0.5 text-center text-neutral-100 outline-none ring-1 ring-brand"
          @keydown.enter.prevent="commitTime"
          @keydown.esc.prevent="cancelTime"
          @blur="commitTime"
        />
        <button
          v-else
          type="button"
          class="rounded px-1 py-0.5 hover:bg-neutral-800 hover:text-white"
          :title="$t('transport.setTime')"
          @click="beginEditTime"
        >
          {{ fmtTime(store.scrub) }}
        </button>
        / {{ fmtTime(store.previewDuration) }}
      </span>
      <span
        v-if="store.hasTrim"
        class="shrink-0 rounded border border-brand/50 bg-brand/15 px-1.5 py-0.5 font-mono text-[10px] text-brand tabular-nums"
        :title="$t('trim.outputHint')"
      >
        {{ $t('trim.output', { duration: store.outputDurationLabel }) }}
      </span>
      <!-- Redundant on mobile (the caption is already on the canvas); hidden there to
           free toolbar width for the playback controls and target toggle. flex-1 +
           min-w-0 lets it take only the leftover width so long captions truncate
           instead of sprawling/wrapping the row. -->
      <span class="hidden min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-500 sm:block">
        {{ store.currentCaption || $t('preview.noCaption') }}
      </span>

      <div class="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div
          v-if="store.hasImages"
          class="flex shrink-0 overflow-hidden rounded-md border border-neutral-700 text-[11px] font-mono"
          role="group"
          :aria-label="$t('preview.dragTarget')"
        >
          <button
            type="button"
            class="px-2.5 py-1 transition-colors"
            :class="
              store.dragTarget === 'caption'
                ? 'bg-brand text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            "
            :aria-pressed="store.dragTarget === 'caption'"
            :title="$t('preview.dragHint')"
            @click="store.dragTarget = 'caption'"
          >
            {{ $t('preview.targetCaption') }}
          </button>
          <button
            type="button"
            class="border-l border-neutral-700 px-2.5 py-1 transition-colors"
            :class="
              store.dragTarget === 'image'
                ? 'bg-brand text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            "
            :aria-pressed="store.dragTarget === 'image'"
            :title="$t('preview.dragImageHint')"
            @click="store.dragTarget = 'image'"
          >
            {{ $t('preview.targetImage') }}
          </button>
        </div>

        <Button
          size="icon"
          variant="secondary"
          class="shrink-0"
          :disabled="store.busy"
          :aria-label="$t('actions.thumbnail')"
          :title="$t('actions.thumbnailHint')"
          @click="store.exportThumbnail()"
        >
          <ImageDownIcon class="size-4" />
        </Button>

        <Button
          size="icon"
          :variant="showSafeArea ? 'default' : 'secondary'"
          class="shrink-0"
          :aria-label="$t('preview.safeArea')"
          :aria-pressed="showSafeArea"
          :title="$t('preview.safeAreaHint')"
          @click="showSafeArea = !showSafeArea"
        >
          <SquareDashedIcon class="size-4" />
        </Button>

        <Button
          size="icon"
          variant="secondary"
          class="shrink-0"
          :aria-label="isFullscreen ? $t('preview.exitFullscreen') : $t('preview.fullscreen')"
          :title="isFullscreen ? $t('preview.exitFullscreen') : $t('preview.fullscreen')"
          @click="toggleFullscreen()"
        >
          <MinimizeIcon v-if="isFullscreen" class="size-4" />
          <MaximizeIcon v-else class="size-4" />
        </Button>
      </div>
    </div>
  </section>
</template>
