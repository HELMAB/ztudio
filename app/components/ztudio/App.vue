<script setup>
import { onMounted } from 'vue'

const store = useGreenroomStore()

onMounted(() => {
  store.init()
})
</script>

<template>
  <div
    class="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground font-sans antialiased"
  >
    <div class="h-0.5 shrink-0 bg-[#00b140]" />
    <GreenroomTopBar />
    <div class="flex flex-1 min-h-0">
      <GreenroomMediaPanel class="w-72 shrink-0 border-r border-border" />
      <GreenroomPreviewStage class="flex-1 min-w-0" />
      <GreenroomInspectorPanel class="w-80 shrink-0 border-l border-border" />
    </div>
    <GreenroomTimeline class="shrink-0 border-t border-border" />
    <GreenroomResultOverlay />
  </div>
</template>
