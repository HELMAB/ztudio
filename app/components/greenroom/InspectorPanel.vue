<script setup>
import { TypeIcon } from '@lucide/vue'
</script>

<template>
  <aside class="flex flex-col min-h-0 bg-background">
    <h2
      class="shrink-0 flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase text-muted-foreground border-b border-border"
    >
      <TypeIcon class="size-3.5 text-[#00b140]" />
      Caption
    </h2>
    <div class="flex-1 min-h-0 overflow-y-auto p-4">
      <GreenroomCaptionControls />
    </div>
  </aside>
</template>
