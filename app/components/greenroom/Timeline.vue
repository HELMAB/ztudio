<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { ImageIcon, MessageSquareIcon, MusicIcon } from '@lucide/vue'

const store = useGreenroomStore()
const trackArea = ref(null)
let dragging = false

const pct = v => `${v}%`
const duration = computed(() => store.previewDuration)

const ticks = computed(() => {
  const d = duration.value
  const step = [1, 2, 5, 10, 15, 30, 60, 120].find(s => d / s <= 10) ?? 300
  const out = []
  for (let t = 0; t <= d + 1e-6; t += step) {
    out.push({ t, left: (t / d) * 100 })
  }
  return out
})

function fmtTick(t) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

const audioClip = computed(() =>
  store.audioBuffer
    ? {
        left: 0,
        width: (store.audioBuffer.duration / duration.value) * 100,
        label: `audio · ${store.audioBuffer.duration.toFixed(1)}s`,
      }
    : null,
)
const imageClip = computed(() =>
  store.imageBitmap
    ? { label: `image · ${store.imageBitmap.width}×${store.imageBitmap.height}` }
    : null,
)
const captionClips = computed(() =>
  store.cues.map((c, i) => ({
    key: i,
    left: (c.start / duration.value) * 100,
    width: ((c.end - c.start) / duration.value) * 100,
    label: c.text.split('\n')[0],
  })),
)
const playheadLeft = computed(() => (store.scrub / duration.value) * 100)

function seekFromEvent(event) {
  const el = trackArea.value
  if (!el) {
    return
  }
  const rect = el.getBoundingClientRect()
  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
  store.seek(ratio * duration.value)
}

function onMove(event) {
  if (dragging) {
    seekFromEvent(event)
  }
}

function onUp() {
  dragging = false
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
}

function onDown(event) {
  dragging = true
  seekFromEvent(event)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

onBeforeUnmount(onUp)
</script>

<template>
  <div class="flex flex-col h-48 select-none bg-background">
    <div class="relative h-6 shrink-0 border-b border-border bg-muted/30">
      <div class="absolute inset-y-0 left-24 right-0">
        <div
          v-for="tick in ticks"
          :key="tick.t"
          class="absolute top-0 h-full flex items-start"
          :style="{ left: pct(tick.left) }"
        >
          <span class="border-l border-border h-2" />
          <span class="font-mono text-[10px] text-muted-foreground pl-1 pt-0.5">
            {{ fmtTick(tick.t) }}
          </span>
        </div>
      </div>
    </div>

    <div class="relative flex-1 min-h-0">
      <div class="absolute left-0 top-0 bottom-0 w-24 z-20 border-r border-border bg-background">
        <div
          class="h-1/3 flex items-center gap-2 px-3 font-mono text-[10px] uppercase text-muted-foreground border-b border-border"
        >
          <MusicIcon class="size-3" />
          Audio
        </div>
        <div
          class="h-1/3 flex items-center gap-2 px-3 font-mono text-[10px] uppercase text-muted-foreground border-b border-border"
        >
          <ImageIcon class="size-3" />
          Image
        </div>
        <div
          class="h-1/3 flex items-center gap-2 px-3 font-mono text-[10px] uppercase text-muted-foreground"
        >
          <MessageSquareIcon class="size-3" />
          Caption
        </div>
      </div>

      <div
        ref="trackArea"
        class="absolute left-24 right-0 top-0 bottom-0 cursor-pointer touch-none"
        @pointerdown="onDown"
      >
        <div class="relative h-1/3 border-b border-border">
          <div
            v-if="audioClip"
            class="absolute inset-y-1 flex items-center overflow-hidden rounded border border-[#00b140]/50 bg-[#00b140]/15 px-2"
            :style="{ left: pct(audioClip.left), width: pct(audioClip.width) }"
          >
            <span class="font-mono text-[10px] text-[#00b140] truncate">{{ audioClip.label }}</span>
          </div>
        </div>

        <div class="relative h-1/3 border-b border-border">
          <div
            v-if="imageClip"
            class="absolute inset-y-1 left-0 right-0 flex items-center overflow-hidden rounded border border-border bg-foreground/10 px-2"
          >
            <span class="font-mono text-[10px] text-muted-foreground truncate">
              {{ imageClip.label }}
            </span>
          </div>
        </div>

        <div class="relative h-1/3">
          <div
            v-for="c in captionClips"
            :key="c.key"
            class="absolute inset-y-1 flex items-center overflow-hidden rounded border border-amber-500/50 bg-amber-500/15 px-2"
            :style="{ left: pct(c.left), width: pct(c.width) }"
          >
            <span class="font-mono text-[10px] text-amber-700 truncate">{{ c.label }}</span>
          </div>
        </div>

        <div
          class="absolute top-0 bottom-0 w-px bg-[#00b140] z-10 pointer-events-none"
          :style="{ left: pct(playheadLeft) }"
        >
          <div class="absolute -translate-x-1/2 size-2.5 rotate-45 bg-[#00b140]" />
        </div>
      </div>
    </div>
  </div>
</template>
