<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { computePeaks, peakBuckets, peaksPath } from '@/lib/ztudio/waveform'
import { drawFrame } from '@/lib/ztudio/renderer'
import { captionAt } from '@/lib/ztudio/srt'
import {
  DiamondPlusIcon,
  ImageIcon,
  MagnetIcon,
  MessageSquarePlusIcon,
  MessageSquareIcon,
  MusicIcon,
  ScanIcon,
  StampIcon,
  TypeIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@lucide/vue'

const store = useZtudioStore()
const { t: tr } = useI18n()

const viewportEl = ref(null)
const laneArea = ref(null)
const { width: trackWidth, height: trackHeight } = useElementSize(viewportEl)

// Zoom state lives in the store (shared with keyboard shortcuts). 1 fits the whole
// duration to the viewport width; below 1 the timeline shrinks to occupy only part
// of the width for a more compact track.
const MIN_ZOOM = 0.25
const MAX_ZOOM = 24

const duration = computed(() => store.previewDuration)
const pxPerSecond = computed(() =>
  duration.value > 0 ? (trackWidth.value * store.timelineZoom) / duration.value : 0,
)
const contentWidth = computed(() => trackWidth.value * store.timelineZoom)

const NICE_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
const ticks = computed(() => {
  const pps = pxPerSecond.value
  const d = duration.value
  if (pps <= 0) {
    return [{ t: 0, left: 0 }]
  }
  const step = NICE_STEPS.find(s => s >= 70 / pps) ?? 300
  const out = []
  for (let t = 0; t <= d + 1e-6; t += step) {
    out.push({ t, left: t * pps })
  }
  return out
})

// Minor ticks subdivide each major step in five, shown only when there's room
// (≥ 9px apart), so the ruler gains detail as you zoom in.
const minorTicks = computed(() => {
  const pps = pxPerSecond.value
  const d = duration.value
  if (pps <= 0) {
    return []
  }
  const step = NICE_STEPS.find(s => s >= 70 / pps) ?? 300
  const sub = step / 5
  if (sub * pps < 9) {
    return []
  }
  const out = []
  for (let t = sub; t <= d + 1e-6; t += sub) {
    if (Math.abs(t / step - Math.round(t / step)) > 1e-6) {
      out.push({ t, left: t * pps })
    }
  }
  return out
})

const clampZoom = z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

// The toolbar slider works in log space so each notch feels like the same
// relative zoom step across the whole 0.25×–24× range.
const ZOOM_LOG_MIN = Math.log2(MIN_ZOOM)
const ZOOM_LOG_MAX = Math.log2(MAX_ZOOM)
const zoomLog = computed(() => Math.log2(store.timelineZoom))
function setZoomLog(v) {
  store.timelineZoom = clampZoom(2 ** v)
}

// Ctrl/Cmd + wheel zooms (the playhead-anchor watcher keeps the edit point in
// view); a plain vertical wheel pans the track horizontally, video-editor style.
function onWheelZoom(e) {
  const el = viewportEl.value
  if (!el) {
    return
  }
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    store.timelineZoom = clampZoom(store.timelineZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))
  } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }
}

// Grabbing the playhead handle scrubs without the initial jump-to-pointer a
// lane click performs (and without touching the cue selection).
function onPlayheadDown(event) {
  event.stopPropagation()
  seeking = true
  window.addEventListener('pointermove', onLaneMove)
  window.addEventListener('pointerup', onLaneUp)
}

function fmtTick(t) {
  if (t >= 60) {
    const m = Math.floor(t / 60)
    const s = Math.round(t % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return Number.isInteger(t) ? `${t}s` : `${t.toFixed(1)}s`
}

function fmtTime(s) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}

const audioClip = computed(() =>
  store.audioBuffer
    ? {
        width: store.audioBuffer.duration * pxPerSecond.value,
        label: `audio · ${store.audioBuffer.duration.toFixed(1)}s`,
      }
    : null,
)

// Waveform peaks are extracted once per loaded buffer (this computed only re-runs
// when the buffer changes, not on zoom); the SVG path then stretches to the lane.
const waveform = computed(() => {
  const buf = store.audioBuffer
  if (!buf) {
    return null
  }
  const n = peakBuckets(buf.duration)
  return { n, path: peaksPath(computePeaks(buf, n), 100) }
})
const trim = computed(() => {
  if (!store.audioBuffer) {
    return null
  }
  const { from, to } = store.trimWindow
  const full = store.audioBuffer.duration * pxPerSecond.value
  return {
    startX: from * pxPerSecond.value,
    endX: to * pxPerSecond.value,
    full,
    active: store.hasTrim,
  }
})

let trimDrag = null
function onTrimDown(event, which) {
  event.stopPropagation()
  trimDrag = which
  window.addEventListener('pointermove', onTrimMove)
  window.addEventListener('pointerup', onTrimUp)
}
function onTrimMove(event) {
  const el = laneArea.value
  const pps = pxPerSecond.value
  if (!trimDrag || !el || pps <= 0) {
    return
  }
  const raw = (event.clientX - el.getBoundingClientRect().left) / pps
  const t = store.snapEdge(raw, { pxPerSecond: pps, disabled: event.altKey })
  if (trimDrag === 'start') {
    store.setTrim(t, store.trimEnd)
  } else {
    store.setTrim(store.trimStart, t)
  }
}
function onTrimUp() {
  trimDrag = null
  store.clearSnap()
  window.removeEventListener('pointermove', onTrimMove)
  window.removeEventListener('pointerup', onTrimUp)
}
const imageClips = computed(() =>
  store.images.map(im => ({
    id: im.id,
    start: im.start,
    end: im.end,
    label: im.name,
  })),
)
const captionClips = computed(() =>
  store.cues.map((c, i) => ({ key: i, start: c.start, end: c.end, label: c.text.split('\n')[0] })),
)
const titleClips = computed(() =>
  store.texts.map(tx => ({
    id: tx.id,
    start: tx.start,
    end: tx.end,
    label: (tx.text || '').split('\n')[0] || tr('textOverlay.untitled'),
  })),
)
const playheadLeft = computed(() => store.scrub * pxPerSecond.value)
const snapGuideLeft = computed(() =>
  store.snapGuide != null ? store.snapGuide * pxPerSecond.value : null,
)

// Hover-scrub: while the mouse moves over the lanes (and nothing is being
// dragged), preview that moment without committing the playhead — a guideline on
// the track plus a floating thumbnail rendered from the same drawFrame the encoder
// uses, with the timecode and the caption at that point.
const hover = ref(null)
const thumbCanvas = ref(null)
const hoverCaption = computed(() => (hover.value ? captionAt(hover.value.t, store.cues) : ''))

let thumbRaf = null
function drawHoverThumb(t) {
  const cv = thumbCanvas.value
  if (!cv) {
    return
  }
  const { w, h } = store.dimensions
  const tw = 144
  const th = Math.max(1, Math.round((tw * h) / w))
  if (cv.width !== tw) {
    cv.width = tw
  }
  if (cv.height !== th) {
    cv.height = th
  }
  drawFrame(cv.getContext('2d'), tw, th, t, {
    images: store.images,
    cues: store.cues,
    style: store.style,
    keyframes: store.keyframes,
    texts: store.texts,
    logo: store.logoResolved,
  })
}

// Throttle thumbnail redraws to one per frame; rAF also lets the teleported canvas
// mount before the first draw.
function scheduleThumb() {
  if (thumbRaf) {
    return
  }
  thumbRaf = requestAnimationFrame(() => {
    thumbRaf = null
    if (hover.value) {
      drawHoverThumb(hover.value.t)
    }
  })
}

function onLaneHover(event) {
  // Skip on touch (no hover) and during any drag (a button is held).
  if (event.pointerType === 'touch' || event.buttons !== 0) {
    hover.value = null
    return
  }
  const el = laneArea.value
  const pps = pxPerSecond.value
  if (!el || pps <= 0) {
    return
  }
  const rect = el.getBoundingClientRect()
  const t = Math.min(Math.max(0, (event.clientX - rect.left) / pps), duration.value)
  hover.value = { x: t * pps, t, clientX: event.clientX, top: rect.top }
  scheduleThumb()
}

function onLaneLeave() {
  hover.value = null
}

const keyframeMarkers = computed(() =>
  store.keyframes.map(k => ({
    id: k.id,
    t: k.t,
    left: k.t * pxPerSecond.value,
    selected: k.id === store.selectedKeyframeId,
  })),
)

function onKeyframeContext(event, m) {
  store.selectKeyframe(m.id)
  store.openContextMenu(event, [
    { label: tr('ctx.goTo'), action: () => store.seek(m.t) },
    { separator: true },
    { label: tr('ctx.delete'), danger: true, action: () => store.removeKeyframe(m.id) },
  ])
}

let kfDrag = null
function onKeyframeDown(event, id) {
  event.stopPropagation()
  store.selectKeyframe(id)
  kfDrag = id
  window.addEventListener('pointermove', onKeyframeMove)
  window.addEventListener('pointerup', onKeyframeUp)
}
function onKeyframeMove(event) {
  const el = laneArea.value
  const pps = pxPerSecond.value
  if (kfDrag == null || !el || pps <= 0) {
    return
  }
  const rect = el.getBoundingClientRect()
  const raw = (event.clientX - rect.left) / pps
  store.moveKeyframe(kfDrag, store.snapEdge(raw, { pxPerSecond: pps, disabled: event.altKey }))
}
function onKeyframeUp() {
  kfDrag = null
  store.clearSnap()
  window.removeEventListener('pointermove', onKeyframeMove)
  window.removeEventListener('pointerup', onKeyframeUp)
}

let seeking = false
function seekFromEvent(event) {
  const el = laneArea.value
  const pps = pxPerSecond.value
  if (!el || pps <= 0) {
    return
  }
  const rect = el.getBoundingClientRect()
  const raw = (event.clientX - rect.left) / pps
  // The playhead snaps to cue/clip edges, but not to itself.
  store.seek(
    store.snapEdge(raw, { pxPerSecond: pps, includePlayhead: false, disabled: event.altKey }),
  )
}
function onLaneMove(event) {
  if (seeking) {
    seekFromEvent(event)
  }
}
function onLaneUp() {
  seeking = false
  store.clearSnap()
  window.removeEventListener('pointermove', onLaneMove)
  window.removeEventListener('pointerup', onLaneUp)
}
function onLaneDown(event) {
  store.selectCue(null)
  seeking = true
  seekFromEvent(event)
  window.addEventListener('pointermove', onLaneMove)
  window.addEventListener('pointerup', onLaneUp)
}
onBeforeUnmount(() => {
  onLaneUp()
  onKeyframeUp()
  onTrimUp()
  if (thumbRaf) {
    cancelAnimationFrame(thumbRaf)
  }
})

// Keep the playhead on screen. During playback it advances on its own; on a
// manual seek (transport buttons, keyboard, prev/next caption) we follow too —
// but never while the user is scrubbing the lane by hand (`seeking`), so the
// drag isn't fought, and never when nothing is zoomed past the viewport.
function followPlayhead() {
  const el = viewportEl.value
  const pps = pxPerSecond.value
  if (!el || pps <= 0) {
    return
  }
  const x = store.scrub * pps
  if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 24) {
    el.scrollLeft = x - el.clientWidth / 2
  }
}

watch(
  () => store.scrub,
  () => {
    if (!seeking) {
      followPlayhead()
    }
  },
)

// Anchor zoom to the playhead: keep it at the same on-screen offset across a
// zoom change so the edit point doesn't drift away. pxPerSecond is proportional
// to zoom, so the pre-zoom scale is recoverable from the old value. flush:'post'
// lets the wider content mount first, so the new scrollLeft isn't clamped.
watch(
  () => store.timelineZoom,
  (z, oldZ) => {
    const el = viewportEl.value
    const pps = pxPerSecond.value
    if (!el || pps <= 0 || !oldZ) {
      return
    }
    const ppsOld = pps * (oldZ / z)
    let anchor = store.scrub * ppsOld - el.scrollLeft
    // If the playhead was off-screen, recentre it instead of preserving the gap.
    if (anchor < 0 || anchor > el.clientWidth) {
      anchor = el.clientWidth / 2
    }
    el.scrollLeft = store.scrub * pps - anchor
  },
  { flush: 'post' },
)
</script>

<template>
  <div class="flex flex-col min-h-0 select-none bg-card">
    <div class="shrink-0 h-9 flex items-center justify-end gap-0.5 px-2 border-b border-border">
      <!-- Icon-only tool cluster (OpenCut-style); each keeps its accessible name. -->
      <Button
        size="icon"
        variant="ghost"
        data-testid="timeline-add-caption"
        class="size-7 text-muted-foreground"
        :aria-label="$t('caption.add')"
        :title="$t('caption.addHint')"
        @click="store.openAddCaption()"
      >
        <MessageSquarePlusIcon class="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        data-testid="timeline-add-keyframe"
        class="size-7 text-muted-foreground"
        :aria-label="$t('keyframe.add')"
        :title="$t('keyframe.addHint')"
        @click="store.addKeyframe()"
      >
        <DiamondPlusIcon class="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        data-testid="timeline-add-title"
        class="size-7 mr-auto text-muted-foreground"
        :aria-label="$t('textOverlay.add')"
        :title="$t('textOverlay.addHint')"
        @click="store.addText()"
      >
        <TypeIcon class="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        class="size-7"
        :class="store.snapEnabled ? 'text-brand bg-brand-muted' : 'text-muted-foreground'"
        :aria-label="$t('timeline.snap')"
        :aria-pressed="store.snapEnabled"
        :title="$t('timeline.snapHint')"
        @click="store.snapEnabled = !store.snapEnabled"
      >
        <MagnetIcon class="size-4" />
      </Button>
      <div class="mx-1.5 h-4 w-px bg-border" />
      <Button
        size="icon"
        variant="ghost"
        class="size-6"
        :disabled="store.timelineZoom <= MIN_ZOOM"
        :aria-label="$t('timeline.zoomOut')"
        @click="store.zoomTimeline('out')"
      >
        <ZoomOutIcon class="size-3.5" />
      </Button>
      <div class="w-24 px-1 hidden sm:block" data-testid="timeline-zoom">
        <Slider
          :model-value="[zoomLog]"
          :min="ZOOM_LOG_MIN"
          :max="ZOOM_LOG_MAX"
          :step="0.05"
          :aria-label="$t('timeline.zoom')"
          @update:model-value="setZoomLog($event[0])"
        />
      </div>
      <Button
        size="icon"
        variant="ghost"
        class="size-6"
        :disabled="store.timelineZoom >= MAX_ZOOM"
        :aria-label="$t('timeline.zoomIn')"
        @click="store.zoomTimeline('in')"
      >
        <ZoomInIcon class="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        class="size-6"
        :aria-label="$t('timeline.fit')"
        @click="store.zoomTimeline('fit')"
      >
        <ScanIcon class="size-3.5" />
      </Button>
      <span class="w-9 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
        {{ Math.round(store.timelineZoom * 100) }}%
      </span>
    </div>

    <div class="flex flex-1 min-h-0">
      <div class="w-16 sm:w-24 shrink-0 z-20 flex flex-col border-r border-border bg-card">
        <div class="h-6 shrink-0 border-b border-border" />
        <div class="flex-1 flex flex-col">
          <div
            class="flex-1 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 overflow-hidden font-mono text-[10px] uppercase text-muted-foreground border-b border-border"
          >
            <MusicIcon class="size-3" />
            {{ $t('timeline.audio') }}
          </div>
          <div
            class="flex-1 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 overflow-hidden font-mono text-[10px] uppercase text-muted-foreground border-b border-border"
          >
            <ImageIcon class="size-3" />
            {{ $t('timeline.image') }}
          </div>
          <div
            class="flex-1 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 overflow-hidden font-mono text-[10px] uppercase text-muted-foreground border-b border-border"
          >
            <MessageSquareIcon class="size-3" />
            {{ $t('timeline.caption') }}
          </div>
          <div
            class="flex-1 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 overflow-hidden font-mono text-[10px] uppercase text-muted-foreground border-b border-border"
          >
            <TypeIcon class="size-3" />
            {{ $t('timeline.title') }}
          </div>
          <div
            class="flex-1 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 overflow-hidden font-mono text-[10px] uppercase text-muted-foreground"
          >
            <StampIcon class="size-3" />
            {{ $t('timeline.logo') }}
          </div>
        </div>
      </div>

      <div
        ref="viewportEl"
        data-testid="timeline-viewport"
        class="flex-1 min-w-0 overflow-x-auto overflow-y-hidden"
        @wheel="onWheelZoom"
      >
        <div
          class="relative flex flex-col"
          :style="{ width: contentWidth + 'px', height: trackHeight + 'px' }"
        >
          <!-- Ruler doubles as a scrub strip: click or drag anywhere on it. -->
          <div
            data-testid="timeline-ruler"
            class="relative h-6 shrink-0 cursor-pointer border-b border-border"
            @pointerdown="onLaneDown"
          >
            <span
              v-for="tick in minorTicks"
              :key="'m' + tick.t"
              class="absolute bottom-0 h-1 border-l border-border/70"
              :style="{ left: tick.left + 'px' }"
            />
            <div
              v-for="tick in ticks"
              :key="tick.t"
              class="absolute top-0 h-full flex items-start"
              :style="{ left: tick.left + 'px' }"
            >
              <span class="border-l border-border h-2" />
              <span
                class="font-mono text-[10px] text-muted-foreground pl-1 pt-0.5 whitespace-nowrap"
              >
                {{ fmtTick(tick.t) }}
              </span>
            </div>
            <button
              v-for="m in keyframeMarkers"
              :key="m.id"
              type="button"
              class="absolute bottom-0.5 size-3 -translate-x-1/2 rotate-45 rounded-[2px] border z-10 touch-none cursor-grab active:cursor-grabbing"
              :class="
                m.selected
                  ? 'bg-brand border-brand'
                  : 'bg-amber-400 border-amber-600 hover:bg-amber-300'
              "
              :style="{ left: m.left + 'px' }"
              :title="$t('keyframe.marker')"
              @pointerdown="onKeyframeDown($event, m.id)"
              @contextmenu="onKeyframeContext($event, m)"
            />
          </div>

          <div
            ref="laneArea"
            class="relative flex-1 flex flex-col cursor-pointer"
            @pointerdown="onLaneDown"
            @pointermove="onLaneHover"
            @pointerleave="onLaneLeave"
          >
            <div class="relative flex-1 border-b border-dashed border-border/80 transition-colors hover:bg-muted/30">
              <div
                v-if="audioClip"
                class="absolute inset-y-1 left-0 flex items-center overflow-hidden rounded border border-brand/50 bg-brand/15 px-2"
                :style="{ width: audioClip.width + 'px' }"
              >
                <svg
                  v-if="waveform"
                  class="absolute inset-0 h-full w-full text-brand/40"
                  :viewBox="`0 0 ${waveform.n} 100`"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path :d="waveform.path" fill="currentColor" />
                </svg>
                <span class="relative z-10 font-mono text-[10px] text-brand truncate">
                  {{ audioClip.label }}
                </span>
              </div>

              <template v-if="trim && trim.active">
                <div
                  class="absolute inset-y-1 left-0 rounded-l bg-card/70 pointer-events-none"
                  :style="{ width: trim.startX + 'px' }"
                />
                <div
                  class="absolute inset-y-1 rounded-r bg-card/70 pointer-events-none"
                  :style="{
                    left: trim.endX + 'px',
                    width: Math.max(0, trim.full - trim.endX) + 'px',
                  }"
                />
              </template>

              <button
                v-if="trim"
                type="button"
                class="absolute inset-y-0.5 z-10 w-2.5 -translate-x-1/2 touch-none rounded-sm border border-brand bg-brand/80 cursor-ew-resize hover:bg-brand"
                :style="{ left: trim.startX + 'px' }"
                :title="$t('trim.start')"
                @pointerdown="onTrimDown($event, 'start')"
              />
              <button
                v-if="trim"
                type="button"
                class="absolute inset-y-0.5 z-10 w-2.5 -translate-x-1/2 touch-none rounded-sm border border-brand bg-brand/80 cursor-ew-resize hover:bg-brand"
                :style="{ left: trim.endX + 'px' }"
                :title="$t('trim.end')"
                @pointerdown="onTrimDown($event, 'end')"
              />
            </div>

            <div class="relative flex-1 border-b border-dashed border-border/80 transition-colors hover:bg-muted/30">
              <ZtudioTimelineImageClip
                v-for="c in imageClips"
                :id="c.id"
                :key="c.id"
                :start="c.start"
                :end="c.end"
                :label="c.label"
                :px-per-second="pxPerSecond"
              />
            </div>

            <div class="relative flex-1 border-b border-dashed border-border/80 transition-colors hover:bg-muted/30">
              <ZtudioTimelineCaptionClip
                v-for="c in captionClips"
                :key="c.key"
                :index="c.key"
                :start="c.start"
                :end="c.end"
                :label="c.label"
                :px-per-second="pxPerSecond"
              />
            </div>

            <div class="relative flex-1 border-b border-dashed border-border/80 transition-colors hover:bg-muted/30">
              <ZtudioTimelineTitleClip
                v-for="c in titleClips"
                :id="c.id"
                :key="c.id"
                :start="c.start"
                :end="c.end"
                :label="c.label"
                :px-per-second="pxPerSecond"
              />
            </div>

            <div class="relative flex-1 transition-colors hover:bg-muted/30">
              <ZtudioTimelineLogoClip
                v-if="store.hasLogo"
                :start="store.logoWindow.start"
                :end="store.logoWindow.end"
                :px-per-second="pxPerSecond"
              />
            </div>
          </div>

          <div
            v-if="hover"
            class="absolute top-0 bottom-0 w-px bg-foreground/40 z-10 pointer-events-none"
            :style="{ left: hover.x + 'px' }"
          />

          <div
            v-if="snapGuideLeft != null"
            class="absolute top-0 bottom-0 w-px bg-cyan-400 z-20 pointer-events-none"
            :style="{ left: snapGuideLeft + 'px' }"
          />

          <div
            class="absolute top-0 bottom-0 z-20 pointer-events-none"
            :style="{ left: playheadLeft + 'px' }"
          >
            <div class="absolute inset-y-0 -translate-x-1/2 w-px bg-brand" />
            <button
              type="button"
              data-testid="playhead-handle"
              class="pointer-events-auto absolute top-1 size-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full bg-brand shadow-sm ring-2 ring-brand/25 transition-transform hover:scale-125"
              :aria-label="$t('timeline.playhead')"
              :title="$t('timeline.playhead')"
              @pointerdown="onPlayheadDown"
            />
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="hover"
        class="pointer-events-none fixed z-50"
        :style="{
          left: hover.clientX + 'px',
          top: hover.top + 'px',
          transform: 'translate(-50%, calc(-100% - 10px))',
        }"
      >
        <div
          class="rounded-md border border-border bg-popover/95 p-1 shadow-xl backdrop-blur-sm"
        >
          <canvas ref="thumbCanvas" class="block rounded-sm bg-black" style="width: 120px" />
          <div class="mt-1 text-center font-mono text-[10px] text-foreground tabular-nums">
            {{ fmtTime(hover.t) }}
          </div>
          <div
            v-if="hoverCaption"
            class="mx-auto max-w-[120px] truncate text-center text-[10px] text-muted-foreground"
          >
            {{ hoverCaption }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
