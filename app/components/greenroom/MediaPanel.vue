<script setup>
import { UploadIcon } from '@lucide/vue'
import { RESOLUTION_OPTIONS } from '@/lib/greenroom/config'

const store = useGreenroomStore()

async function onAudio(event) {
  const ok = await store.loadAudio(event.target.files[0])
  if (!ok) {
    event.target.value = ''
  }
}

function onImage(event) {
  store.loadImage(event.target.files[0])
}

function onSrt(event) {
  store.loadSrt(event.target.files[0])
}
</script>

<template>
  <aside class="flex flex-col min-h-0 bg-background">
    <div class="shrink-0 p-4 space-y-4 border-b border-border">
      <h2 class="flex items-center gap-2 font-mono text-[11px] uppercase text-muted-foreground">
        <UploadIcon class="size-3.5 text-[#00b140]" />
        Media
      </h2>
      <GreenroomField label="Aspect & resolution">
        <GreenroomSelectField v-model="store.resolution" :options="RESOLUTION_OPTIONS" />
      </GreenroomField>
      <GreenroomFileInput label="Audio — required, max 5:00" accept="audio/*" @select="onAudio" />
      <GreenroomFileInput label="Image — optional" accept="image/*" @select="onImage" />
      <GreenroomFileInput
        label="Captions — optional, .srt"
        accept=".srt,text/plain"
        @select="onSrt"
      />
      <GreenroomReadinessPills />
    </div>
    <GreenroomActivityLog class="flex-1 min-h-0" />
  </aside>
</template>
