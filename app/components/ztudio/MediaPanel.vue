<script setup>
import { UploadIcon } from '@lucide/vue'
import { RESOLUTION_OPTIONS } from '@/lib/ztudio/config'

const store = useZtudioStore()

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
      <ZtudioField label="Aspect & resolution">
        <ZtudioSelectField v-model="store.resolution" :options="RESOLUTION_OPTIONS" />
      </ZtudioField>
      <ZtudioFileInput label="Audio — required, max 5:00" accept="audio/*" @select="onAudio" />
      <ZtudioFileInput label="Image — optional" accept="image/*" @select="onImage" />
      <ZtudioFileInput
        label="Captions — optional, .srt"
        accept=".srt,text/plain"
        @select="onSrt"
      />
      <ZtudioReadinessPills />
    </div>
    <ZtudioActivityLog class="flex-1 min-h-0" />
  </aside>
</template>
