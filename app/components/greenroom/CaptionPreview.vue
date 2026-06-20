<script setup>
import { onMounted, ref, watchEffect } from 'vue'
import { drawFrame } from '@/lib/greenroom/renderer'

const store = useGreenroom()
const canvas = ref(null)

onMounted(() => {
  watchEffect(() => {
    const el = canvas.value
    if (!el) {
      return
    }

    const { w, h } = store.dimensions
    const t = store.scrub
    const style = store.style
    const imageBitmap = store.imageBitmap
    const cues = store.cues
    const imageFit = store.controls.imageFit
    /* eslint-disable-next-line no-unused-expressions */
    store.previewTick

    el.width = w
    el.height = h
    drawFrame(el.getContext('2d'), w, h, t, { imageBitmap, imageFit, cues, style })
  })
})
</script>

<template>
  <div>
    <canvas ref="canvas" width="1080" height="1920" class="block w-full max-w-[260px] border border-border bg-black" />
    <div class="mt-2 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
      <span class="text-foreground">{{ store.timeLabel }}</span> · live preview
    </div>
    <div class="mt-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap min-h-[1.4em] max-w-[260px]">
      {{ store.currentCaption || '— no caption at this time —' }}
    </div>
  </div>
</template>
