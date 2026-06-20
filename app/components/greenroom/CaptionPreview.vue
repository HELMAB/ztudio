<script setup>
import { onMounted, ref, watch } from 'vue'
import { drawFrame } from '@/lib/greenroom/renderer'

const store = useGreenroomStore()
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
</script>

<template>
  <div>
    <canvas
      ref="canvas"
      width="1080"
      height="1920"
      class="block w-full max-w-[260px] border border-border bg-black"
    />
    <div class="mt-2 font-mono text-[11px] text-muted-foreground uppercase">
      <span class="text-foreground">{{ store.timeLabel }}</span> · live preview
    </div>
    <div
      class="mt-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap min-h-[1.4em] max-w-[260px]"
    >
      {{ store.currentCaption || '— no caption at this time —' }}
    </div>
  </div>
</template>
