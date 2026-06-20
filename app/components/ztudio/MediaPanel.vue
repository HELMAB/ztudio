<script setup>
import { computed } from 'vue'
import { UploadIcon } from '@lucide/vue'
import { RESOLUTION_OPTIONS } from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const resolutionOptions = computed(() =>
  RESOLUTION_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })),
)

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
        {{ $t('media.heading') }}
      </h2>
      <ZtudioField :label="$t('media.resolution')">
        <ZtudioSelectField v-model="store.resolution" :options="resolutionOptions" />
      </ZtudioField>
      <ZtudioFileInput :label="$t('media.audio')" accept="audio/*" @select="onAudio" />
      <ZtudioFileInput :label="$t('media.image')" accept="image/*" @select="onImage" />
      <ZtudioFileInput :label="$t('media.captions')" accept=".srt,text/plain" @select="onSrt" />
      <ZtudioReadinessPills />
    </div>
    <ZtudioActivityLog class="flex-1 min-h-0" />
  </aside>
</template>
