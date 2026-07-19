<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageDownIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  Repeat2Icon,
  SkipBackIcon,
  SkipForwardIcon,
  SquareDashedIcon,
} from '@lucide/vue'
import { captionBox, captionCenter, drawFrame, logoRect, titleBox } from '@/lib/ztudio/renderer'
import { imageDrawRect } from '@/lib/ztudio/images'
import { imageFramingAt } from '@/lib/ztudio/keyframes'
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
    images: store.renderImages,
    cues: store.renderCues,
    style: store.style,
    keyframes: store.keyframes,
    texts: store.renderTexts,
    logo: store.renderLogo,
  })
  if (showSafeArea.value) {
    drawSafeArea(ctx, w, h)
  }
  if (dragging.value) {
    drawGuides(ctx, w, h)
  }
}

// Selection gizmo for the focused layer: a rotated bounding box with corner
// resize handles and a rotate handle above the top edge. For an image clip the
// corners drive zoom and the handle drives the clip's rotation; for the caption
// they drive the global font size and caption rotation. Rendered as an SVG
// overlay (not on the canvas) so handles stay visible and grabbable even when
// the content fills or overflows the frame. Geometry comes from the same
// imageDrawRect / captionBox the renderer uses, so the box always hugs the
// drawn pixels; handle sizes are scaled by k (canvas px per CSS px) so they
// render at a constant on-screen size. Preview only — never part of the encode.
const { width: canvasDispW, height: canvasDispH } = useElementSize(canvas)

const gizmo = computed(() => {
  // previewTick invalidates on any redraw (zoom/rotation/size edits).
  void store.previewTick
  if (store.isPlaying) {
    return null
  }
  const { w, h } = store.dimensions
  const k = canvasDispW.value > 0 ? w / canvasDispW.value : 1
  // Stem short enough that the rotate handle stays inside the stage padding
  // (the panel clips overflow) even when the content fills the whole frame.
  const handles = { hs: 10 * k, rotOff: 16 * k, k }
  if (store.dragTarget === 'image') {
    const img = store.activeImage
    if (!img) {
      return null
    }
    const frame = imageFramingAt(img, store.keyframes, store.scrub)
    const r = imageDrawRect(w, h, img, frame)
    return { kind: 'image', img, ...r, ...handles }
  }
  if (store.dragTarget === 'caption') {
    const el = canvas.value
    const text = store.currentCaption
    if (!el || !text) {
      return null
    }
    const box = captionBox(el.getContext('2d'), w, h, text, store.style)
    if (!box) {
      return null
    }
    return {
      kind: 'caption',
      cx: box.cx,
      cy: box.cy,
      dw: box.bw,
      dh: box.bh,
      rotation: box.rotation,
      ...handles,
    }
  }
  if (store.dragTarget === 'title') {
    const el = canvas.value
    // Same pick as a canvas drag: the selected title when it's on screen,
    // otherwise whichever title is showing at the playhead.
    let tx = store.selectedText
    if (!tx || store.scrub < tx.start || store.scrub >= tx.end) {
      tx = store.activeText
    }
    if (!el || !tx) {
      return null
    }
    const box = titleBox(el.getContext('2d'), w, h, tx)
    if (!box) {
      return null
    }
    return {
      kind: 'title',
      tx,
      cx: box.cx,
      cy: box.cy,
      dw: box.bw,
      dh: box.bh,
      rotation: box.rotation,
      ...handles,
    }
  }
  if (store.dragTarget === 'logo') {
    // Only while the logo is drawn: present, lane visible, playhead inside its
    // window.
    const lg = store.renderLogo
    if (!lg) {
      return null
    }
    const { start, end } = store.logoWindow
    if (store.scrub < start || store.scrub >= end) {
      return null
    }
    const r = logoRect(w, h, lg)
    return {
      kind: 'logo',
      cx: r.cx,
      cy: r.cy,
      dw: r.lw,
      dh: r.lh,
      rotation: r.rotation,
      ...handles,
    }
  }
  return null
})

const gizmoCorners = computed(() => {
  const g = gizmo.value
  if (!g) {
    return []
  }
  return [
    [-g.dw / 2, -g.dh / 2],
    [g.dw / 2, -g.dh / 2],
    [-g.dw / 2, g.dh / 2],
    [g.dw / 2, g.dh / 2],
  ]
})

// The overlay sits exactly over the canvas box inside the (relative) stage
// padding container. Tracked via the canvas's offset box; useElementSize above
// retriggers this on any resize.
const overlayBox = computed(() => {
  void canvasDispW.value
  void canvasDispH.value
  const el = canvas.value
  if (!el || !gizmo.value) {
    return null
  }
  return {
    left: el.offsetLeft + 'px',
    top: el.offsetTop + 'px',
    width: el.offsetWidth + 'px',
    height: el.offsetHeight + 'px',
  }
})

// Gizmo drags run on window listeners (the pointer may leave the small handle).
// Coords are mapped into canvas pixels; values may fall outside the frame, which
// is fine — the math only needs the distance/angle from the box centre.
let gdrag = null

function gizmoPoint(e) {
  const el = canvas.value
  const rect = el.getBoundingClientRect()
  return {
    px: (e.clientX - rect.left) * (el.width / rect.width),
    py: (e.clientY - rect.top) * (el.height / rect.height),
  }
}

function startGizmo(mode, e) {
  const g = gizmo.value
  if (!g) {
    return
  }
  e.preventDefault()
  e.stopPropagation()
  if (g.kind === 'image') {
    store.selectImage(g.img.id)
  } else if (g.kind === 'title') {
    store.selectText(g.tx.id)
  }
  const { px, py } = gizmoPoint(e)
  gdrag = {
    mode,
    kind: g.kind,
    textId: g.tx?.id,
    cx: g.cx,
    cy: g.cy,
    startAngle: (Math.atan2(py - g.cy, px - g.cx) * 180) / Math.PI,
    origRotation: g.rotation || 0,
    startDist: Math.max(1, Math.hypot(px - g.cx, py - g.cy)),
    origZoom: g.kind === 'image' ? g.img.zoom || 1 : 1,
    origSize:
      g.kind === 'title'
        ? g.tx.fontSizePct
        : g.kind === 'logo'
          ? store.logo.scalePct
          : store.controls.fontSizePct,
  }
  dragging.value = true
  window.addEventListener('pointermove', onGizmoMove)
  window.addEventListener('pointerup', onGizmoUp)
}

function onGizmoMove(e) {
  if (!gdrag) {
    return
  }
  const { px, py } = gizmoPoint(e)
  const dx = px - gdrag.cx
  const dy = py - gdrag.cy
  if (gdrag.mode === 'rotate') {
    // Rotation follows the pointer's angle, snapping to 45° steps unless Alt is
    // held (the same snap-disable modifier as the timeline).
    let deg = gdrag.origRotation + (Math.atan2(dy, dx) * 180) / Math.PI - gdrag.startAngle
    if (!e.altKey) {
      const snap = Math.round(deg / 45) * 45
      if (Math.abs(deg - snap) < 4) {
        deg = snap
      }
    }
    if (gdrag.kind === 'image') {
      store.setImageRotation(deg)
    } else if (gdrag.kind === 'title') {
      store.setTextRotation(gdrag.textId, deg)
    } else if (gdrag.kind === 'logo') {
      store.setLogoRotation(deg)
    } else {
      store.setCaptionRotation(deg)
    }
  } else {
    // Resize scales zoom (image), font size (caption/title) or logo scale by
    // the pointer's distance from the centre.
    const ratio = Math.hypot(dx, dy) / gdrag.startDist
    if (gdrag.kind === 'image') {
      store.setImageZoom(gdrag.origZoom * ratio)
    } else if (gdrag.kind === 'title') {
      store.setTextFontSize(gdrag.textId, gdrag.origSize * ratio)
    } else if (gdrag.kind === 'logo') {
      store.setLogoScale(gdrag.origSize * ratio)
    } else {
      store.setCaptionFontSize(gdrag.origSize * ratio)
    }
  }
}

function onGizmoUp() {
  gdrag = null
  dragging.value = false
  window.removeEventListener('pointermove', onGizmoMove)
  window.removeEventListener('pointerup', onGizmoUp)
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
  } else if (store.dragTarget === 'title') {
    const tx = store.selectedText
    xCentered = !!tx && (tx.x ?? 0.5) === 0.5
    yCentered = !!tx && (tx.y ?? 0.5) === 0.5
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
      store.texts,
      store.selectedTextId,
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
  onGizmoUp()
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

  // The logo is corner-pinned (no free positioning), so with the logo focused a
  // canvas drag is a no-op — its gizmo handles do the resizing/rotating.
  if (store.dragTarget === 'logo') {
    return
  }

  // Title drag: move the selected title if it's on screen, otherwise whichever
  // title is showing at the playhead. With none showing the drag is a no-op.
  if (store.dragTarget === 'title') {
    let tx = store.selectedText
    if (!tx || store.scrub < tx.start || store.scrub >= tx.end) {
      tx = store.activeText
    }
    if (!tx) {
      return
    }
    if (store.selectedTextId !== tx.id) {
      store.selectText(tx.id)
    }
    el.setPointerCapture(e.pointerId)
    drag = {
      startX: e.clientX,
      startY: e.clientY,
      rect: el.getBoundingClientRect(),
      title: true,
      textId: tx.id,
      offX: tx.x ?? 0.5,
      offY: tx.y ?? 0.5,
    }
    dragging.value = true
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

  if (drag.title) {
    // Title x/y are the centre as a fraction of the frame; snap to the mid-axes.
    if (Math.abs(x - 0.5) < SNAP) {
      x = 0.5
    }
    if (Math.abs(y - 0.5) < SNAP) {
      y = 0.5
    }
    store.setTextPos(drag.textId, x, y)
    return
  }

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
  } else if (store.dragTarget === 'title') {
    const tx = store.selectedText
    if (tx) {
      store.setTextPos(tx.id, 0.5, 0.5)
      store.setTextRotation(tx.id, 0)
    }
  } else if (store.dragTarget === 'logo') {
    store.setLogoRotation(0)
  } else {
    store.resetCaptionOffset()
  }
}
</script>

<template>
  <section ref="stageEl" class="flex flex-col min-w-0 bg-card">
    <div class="relative flex-1 min-h-0 flex items-center justify-center p-2 sm:p-6">
      <canvas
        ref="canvas"
        data-testid="preview-canvas"
        width="1080"
        height="1920"
        class="max-w-full max-h-full rounded-md object-contain shadow-[0_8px_30px_rgb(0_0_0/0.12)] ring-1 ring-black/10 dark:shadow-[0_8px_30px_rgb(0_0_0/0.5)] dark:ring-white/10 cursor-grab touch-none select-none active:cursor-grabbing"
        :title="
          store.dragTarget === 'image'
            ? $t('preview.dragImageHint')
            : store.dragTarget === 'title'
              ? $t('preview.dragTitleHint')
              : store.dragTarget === 'logo'
                ? $t('preview.dragLogoHint')
                : $t('preview.dragHint')
        "
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
        @dblclick="onResetDrag"
      />

      <!-- Selection gizmo (image clip or caption): overlays the canvas 1:1
           (same viewBox as the frame), overflow visible so handles survive
           full-frame content. The root ignores pointers; only the handles are
           interactive. -->
      <svg
        v-if="gizmo && overlayBox"
        data-testid="preview-gizmo"
        class="absolute z-10 overflow-visible pointer-events-none"
        :style="overlayBox"
        :viewBox="`0 0 ${store.dimensions.w} ${store.dimensions.h}`"
      >
        <g :transform="`translate(${gizmo.cx} ${gizmo.cy}) rotate(${gizmo.rotation})`">
          <rect
            :x="-gizmo.dw / 2"
            :y="-gizmo.dh / 2"
            :width="gizmo.dw"
            :height="gizmo.dh"
            fill="none"
            stroke="#4abf76"
            :stroke-width="1.5 * gizmo.k"
          />
          <line
            x1="0"
            :y1="-gizmo.dh / 2"
            x2="0"
            :y2="-gizmo.dh / 2 - gizmo.rotOff"
            stroke="#4abf76"
            :stroke-width="1.5 * gizmo.k"
          />
          <circle
            data-testid="gizmo-rotate"
            cx="0"
            :cy="-gizmo.dh / 2 - gizmo.rotOff"
            :r="gizmo.hs / 2"
            fill="#ffffff"
            stroke="#4abf76"
            :stroke-width="1.5 * gizmo.k"
            class="pointer-events-auto cursor-grab touch-none"
            @pointerdown="startGizmo('rotate', $event)"
          />
          <rect
            v-for="(c, i) in gizmoCorners"
            :key="i"
            data-testid="gizmo-corner"
            :x="c[0] - gizmo.hs / 2"
            :y="c[1] - gizmo.hs / 2"
            :width="gizmo.hs"
            :height="gizmo.hs"
            :rx="gizmo.hs / 5"
            fill="#ffffff"
            stroke="#4abf76"
            :stroke-width="1.5 * gizmo.k"
            class="pointer-events-auto cursor-nwse-resize touch-none"
            @pointerdown="startGizmo('resize', $event)"
          />
        </g>
      </svg>
    </div>

    <!-- Transport bar: timecode left, playback centred, utilities right (three-zone
         grid on sm+; wraps into a single flow on narrow screens). -->
    <div
      class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-card border-t border-border sm:grid sm:grid-cols-[1fr_auto_1fr]"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span class="font-mono text-xs tabular-nums shrink-0 text-muted-foreground">
          <input
            v-if="editingTime"
            ref="timeField"
            v-model="timeInput"
            type="text"
            inputmode="decimal"
            class="w-14 rounded bg-muted px-1 py-0.5 text-center text-foreground outline-none ring-1 ring-brand"
            @keydown.enter.prevent="commitTime"
            @keydown.esc.prevent="cancelTime"
            @blur="commitTime"
          />
          <button
            v-else
            type="button"
            data-testid="current-time"
            class="rounded px-1 py-0.5 text-brand hover:bg-brand-muted"
            :title="$t('transport.setTime')"
            @click="beginEditTime"
          >
            {{ fmtTime(store.scrub) }}
          </button>
          / {{ fmtTime(store.previewDuration) }}
        </span>
        <span
          v-if="store.hasTrim"
          class="shrink-0 rounded-md border border-brand/40 bg-brand-muted px-1.5 py-0.5 font-mono text-[10px] text-brand tabular-nums"
          :title="$t('trim.outputHint')"
        >
          {{ $t('trim.output', { duration: store.outputDurationLabel }) }}
        </span>
        <!-- Redundant on mobile (the caption is already on the canvas); hidden there to
             free toolbar width for the playback controls. min-w-0 lets long captions
             truncate instead of sprawling. -->
        <span class="hidden min-w-0 truncate text-[11px] text-muted-foreground/70 sm:block">
          {{ store.currentCaption || $t('preview.noCaption') }}
        </span>
      </div>

      <div class="flex items-center gap-0.5 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          class="size-7 text-muted-foreground"
          :aria-label="$t('transport.start')"
          :title="$t('transport.start')"
          @click="store.seek(0)"
        >
          <SkipBackIcon class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          class="size-7 text-muted-foreground"
          :aria-label="$t('transport.prevCaption')"
          :title="$t('transport.prevCaption')"
          @click="store.jumpCue(-1)"
        >
          <ChevronLeftIcon class="size-4" />
        </Button>
        <Button
          size="icon"
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
          class="size-7 text-muted-foreground"
          :aria-label="$t('transport.nextCaption')"
          :title="$t('transport.nextCaption')"
          @click="store.jumpCue(1)"
        >
          <ChevronRightIcon class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          class="size-7 text-muted-foreground"
          :aria-label="$t('transport.end')"
          :title="$t('transport.end')"
          @click="store.seek(store.previewDuration)"
        >
          <SkipForwardIcon class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          class="size-7"
          :class="store.loopPlayback ? 'text-brand bg-brand-muted' : 'text-muted-foreground'"
          :aria-label="$t('transport.loop')"
          :aria-pressed="store.loopPlayback"
          :title="$t('transport.loopHint')"
          data-testid="transport-loop"
          @click="store.loopPlayback = !store.loopPlayback"
        >
          <Repeat2Icon class="size-4" />
        </Button>
      </div>

      <div class="ml-auto flex items-center gap-1 sm:justify-self-end">
        <ZtudioVolumeControl />
        <Button
          size="icon"
          variant="ghost"
          class="shrink-0 text-muted-foreground"
          :disabled="store.busy"
          :aria-label="$t('actions.thumbnail')"
          :title="$t('actions.thumbnailHint')"
          @click="store.exportThumbnail()"
        >
          <ImageDownIcon class="size-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          class="shrink-0"
          :class="showSafeArea ? 'text-brand bg-brand-muted' : 'text-muted-foreground'"
          :aria-label="$t('preview.safeArea')"
          :aria-pressed="showSafeArea"
          :title="$t('preview.safeAreaHint')"
          @click="showSafeArea = !showSafeArea"
        >
          <SquareDashedIcon class="size-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          class="shrink-0 text-muted-foreground"
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
