<script setup>
import { onMounted } from 'vue'

const store = useZtudioStore()

onMounted(() => {
  store.init()
})
</script>

<template>
  <div
    class="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground font-sans antialiased"
  >
    <div class="h-0.5 shrink-0 bg-[#00b140]" />
    <ZtudioTopBar />
    <div class="flex flex-1 min-h-0">
      <ZtudioMediaPanel class="w-72 shrink-0 border-r border-border" />
      <ZtudioPreviewStage class="flex-1 min-w-0" />
      <ZtudioInspectorPanel class="w-80 shrink-0 border-l border-border" />
    </div>
    <ZtudioTimeline class="shrink-0 border-t border-border" />
    <ZtudioResultOverlay />
  </div>
</template>
