<script setup>
import { onMounted, ref, watch } from 'vue'
import { PauseIcon, PlayIcon } from '@lucide/vue'
import { drawFrame } from '@/lib/ztudio/renderer'

const store = useZtudioStore()
const canvas = ref(null)

function paint() {
  const el = canvas.value
  if (!el) {
    return
  }
  const { w, h } = store.dimensions
  el.width = w
  el.height = h
  drawFrame(el.getContext('2d'), w, h, store.scrub, {
    imageBitmap: store.imageBitmap,
    imageFit: store.controls.imageFit,
    cues: store.cues,
    style: store.style,
  })
}

onMounted(() => {
  watch(
    () => [
      store.dimensions,
      store.scrub,
      store.style,
      store.imageBitmap,
      store.cues,
      store.controls.imageFit,
      store.previewTick,
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
</script>

<template>
  <section class="flex flex-col min-w-0 bg-neutral-900">
    <div class="flex-1 min-h-0 flex items-center justify-center p-6">
      <canvas
        ref="canvas"
        width="1080"
        height="1920"
        class="max-w-full max-h-full object-contain border border-neutral-700 shadow-lg"
      />
    </div>

    <div
      class="shrink-0 flex items-center gap-4 px-6 py-3 bg-neutral-950 border-t border-neutral-800"
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
      <span class="font-mono text-[11px] text-neutral-500 truncate">
        {{ store.currentCaption || $t('preview.noCaption') }}
      </span>
    </div>
  </section>
</template>
