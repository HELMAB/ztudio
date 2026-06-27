<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { computePeaks, peakBuckets, peaksPath } from '@/lib/ztudio/waveform'
import {
  DiamondPlusIcon,
  ImageIcon,
  MessageSquarePlusIcon,
  MessageSquareIcon,
  MusicIcon,
  ScanIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@lucide/vue'

const store = useZtudioStore()

const viewportEl = ref(null)
const laneArea = ref(null)
const { width: trackWidth, height: trackHeight } = useElementSize(viewportEl)

// zoom 1 fits the whole duration to the viewport width; below 1 the timeline
// shrinks to occupy only part of the width for a more compact track.
const MIN_ZOOM = 0.25
const MAX_ZOOM = 24
const zoom = ref(1)

const duration = computed(() => store.previewDuration)
const pxPerSecond = computed(() =>
  duration.value > 0 ? (trackWidth.value * zoom.value) / duration.value : 0,
)
const contentWidth = computed(() => trackWidth.value * zoom.value)

function zoomIn() {
  zoom.value = Math.min(zoom.value * 1.5, MAX_ZOOM)
}
function zoomOut() {
  zoom.value = Math.max(zoom.value / 1.5, MIN_ZOOM)
}
function zoomFit() {
  zoom.value = 1
}

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

function fmtTick(t) {
  if (t >= 60) {
    const m = Math.floor(t / 60)
    const s = Math.round(t % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return Number.isInteger(t) ? `${t}s` : `${t.toFixed(1)}s`
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
  const t = (event.clientX - el.getBoundingClientRect().left) / pps
  if (trimDrag === 'start') {
    store.setTrim(t, store.trimEnd)
  } else {
    store.setTrim(store.trimStart, t)
  }
}
function onTrimUp() {
  trimDrag = null
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
const playheadLeft = computed(() => store.scrub * pxPerSecond.value)

const keyframeMarkers = computed(() =>
  store.keyframes.map(k => ({
    id: k.id,
    left: k.t * pxPerSecond.value,
    selected: k.id === store.selectedKeyframeId,
  })),
)

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
  store.moveKeyframe(kfDrag, (event.clientX - rect.left) / pps)
}
function onKeyframeUp() {
  kfDrag = null
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
  store.seek((event.clientX - rect.left) / pps)
}
function onLaneMove(event) {
  if (seeking) {
    seekFromEvent(event)
  }
}
function onLaneUp() {
  seeking = false
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
})

watch(
  () => store.scrub,
  () => {
    if (!store.isPlaying) {
      return
    }
    const el = viewportEl.value
    if (!el) {
      return
    }
    const x = store.scrub * pxPerSecond.value
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 24) {
      el.scrollLeft = x - el.clientWidth / 2
    }
  },
)
</script>

<template>
  <div class="flex flex-col min-h-0 select-none bg-background">
    <div class="shrink-0 h-8 flex items-center justify-end gap-1 px-3 border-b border-border">
      <Button
        size="sm"
        variant="ghost"
        class="h-6 text-[11px] text-muted-foreground"
        :title="$t('caption.addHint')"
        @click="store.openAddCaption()"
      >
        <MessageSquarePlusIcon class="size-3.5" />
        <span class="hidden sm:inline">{{ $t('caption.add') }}</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        class="h-6 mr-auto text-[11px] text-muted-foreground"
        :title="$t('keyframe.addHint')"
        @click="store.addKeyframe()"
      >
        <DiamondPlusIcon class="size-3.5" />
        <span class="hidden sm:inline">{{ $t('keyframe.add') }}</span>
      </Button>
      <span class="font-mono text-[10px] text-muted-foreground mr-1 tabular-nums">
        {{ Math.round(zoom * 100) }}%
      </span>
      <Button
        size="icon"
        variant="ghost"
        class="size-6"
        :disabled="zoom <= MIN_ZOOM"
        :aria-label="$t('timeline.zoomOut')"
        @click="zoomOut"
      >
        <ZoomOutIcon class="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        class="size-6"
        :aria-label="$t('timeline.fit')"
        @click="zoomFit"
      >
        <ScanIcon class="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        class="size-6"
        :disabled="zoom >= MAX_ZOOM"
        :aria-label="$t('timeline.zoomIn')"
        @click="zoomIn"
      >
        <ZoomInIcon class="size-3.5" />
      </Button>
    </div>

    <div class="flex flex-1 min-h-0">
      <div class="w-16 sm:w-24 shrink-0 z-20 flex flex-col border-r border-border bg-background">
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
            class="flex-1 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 overflow-hidden font-mono text-[10px] uppercase text-muted-foreground"
          >
            <MessageSquareIcon class="size-3" />
            {{ $t('timeline.caption') }}
          </div>
        </div>
      </div>

      <div ref="viewportEl" class="flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
        <div
          class="relative flex flex-col"
          :style="{ width: contentWidth + 'px', height: trackHeight + 'px' }"
        >
          <div class="relative h-6 shrink-0 border-b border-border bg-muted/30">
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
            />
          </div>

          <div
            ref="laneArea"
            class="relative flex-1 flex flex-col cursor-pointer"
            @pointerdown="onLaneDown"
          >
            <div class="relative flex-1 border-b border-border">
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
                  class="absolute inset-y-1 left-0 rounded-l bg-background/70 pointer-events-none"
                  :style="{ width: trim.startX + 'px' }"
                />
                <div
                  class="absolute inset-y-1 rounded-r bg-background/70 pointer-events-none"
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

            <div class="relative flex-1 border-b border-border">
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

            <div class="relative flex-1">
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
          </div>

          <div
            class="absolute top-0 bottom-0 w-px bg-brand z-10 pointer-events-none"
            :style="{ left: playheadLeft + 'px' }"
          >
            <div class="absolute -translate-x-1/2 size-2.5 rotate-45 bg-brand" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
