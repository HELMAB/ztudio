<script setup>
import { computed } from 'vue'
import { DownloadIcon } from '@lucide/vue'

const store = useZtudioStore()

// A compact, scannable stat grid replaces the old run-on stats line. Frames are
// only known on the fast (WebCodecs) path, so that cell is conditional.
const stats = computed(() => {
  const r = store.result
  const out = [
    { key: 'statSize', value: `${r.sizeMB} MB` },
    { key: 'statDuration', value: `${r.dur}s` },
  ]
  if (r.frames != null) {
    out.push({ key: 'statFrames', value: Number(r.frames).toLocaleString() })
  }
  out.push({ key: 'statSpeed', value: `${r.ratio}×` })
  return out
})
</script>

<template>
  <div class="grid gap-6 sm:grid-cols-[260px_1fr] sm:items-start">
    <!-- Preview: centred and height-capped so a tall portrait export never blows
         out the dialog on mobile. -->
    <div class="flex justify-center">
      <video
        :src="store.result.url"
        data-testid="result-video"
        controls
        playsinline
        class="block max-h-[48dvh] w-auto max-w-full rounded-lg border border-border bg-black shadow-sm sm:max-h-[64dvh]"
      />
    </div>

    <div class="flex min-w-0 flex-col">
      <ZtudioPill :ok="true" class="self-start">{{ store.result.label }}</ZtudioPill>

      <dl class="mt-3 grid grid-cols-2 gap-2">
        <div
          v-for="s in stats"
          :key="s.key"
          class="rounded-lg border border-border bg-muted/30 px-3 py-2"
        >
          <dt class="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {{ $t(`result.${s.key}`) }}
          </dt>
          <dd class="mt-0.5 font-mono text-sm tabular-nums text-foreground">{{ s.value }}</dd>
        </div>
      </dl>

      <a
        :href="store.result.url"
        :download="$t('result.downloadName', { ext: store.result.ext })"
        data-testid="result-download"
        class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm shadow-brand/20 transition-colors hover:bg-brand/90"
      >
        <DownloadIcon class="size-4" />
        {{ $t('actions.download', { file: $t('result.downloadName', { ext: store.result.ext }) }) }}
      </a>
    </div>
  </div>
</template>
