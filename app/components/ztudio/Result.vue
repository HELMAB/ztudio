<script setup>
import { DownloadIcon } from '@lucide/vue'

const store = useZtudioStore()
</script>

<template>
  <div class="grid sm:grid-cols-2 gap-4">
    <div>
      <video
        :src="store.result.url"
        data-testid="result-video"
        controls
        playsinline
        class="block w-full max-w-[260px] border border-border"
      />
    </div>
    <div>
      <ZtudioPill :ok="true">{{ store.result.label }}</ZtudioPill>
      <p class="text-sm text-muted-foreground mt-2">
        <template v-if="store.result.frames != null">{{
          $t('result.statsFrames', {
            size: store.result.sizeMB,
            dur: store.result.dur,
            frames: store.result.frames,
            ratio: store.result.ratio,
          })
        }}</template>
        <template v-else>{{
          $t('result.stats', {
            size: store.result.sizeMB,
            dur: store.result.dur,
            ratio: store.result.ratio,
          })
        }}</template>
      </p>
      <a
        :href="store.result.url"
        :download="$t('result.downloadName', { ext: store.result.ext })"
        data-testid="result-download"
        class="inline-flex items-center gap-1.5 mt-2.5 font-semibold text-brand border-b border-brand pb-px"
      >
        <DownloadIcon class="size-4" />
        {{ $t('actions.download', { file: $t('result.downloadName', { ext: store.result.ext }) }) }}
      </a>
    </div>
  </div>
</template>
