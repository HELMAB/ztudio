<script setup>
import { computed } from 'vue'
import { CaptionsIcon, ImageIcon, MusicIcon, UploadIcon } from '@lucide/vue'
import {
  FORMAT_OPTIONS,
  FPS_OPTIONS,
  QUALITY_OPTIONS,
  RESOLUTION_OPTIONS,
} from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const localize = options =>
  computed(() => options.map(o => ({ value: o.value, label: t(o.labelKey) })))

const resolutionOptions = localize(RESOLUTION_OPTIONS)
const qualityOptions = localize(QUALITY_OPTIONS)
const formatOptions = localize(FORMAT_OPTIONS)
// fps is a number; the Select rides on strings, so proxy the conversion.
const fpsOptions = computed(() =>
  FPS_OPTIONS.map(o => ({ value: String(o.value), label: t(o.labelKey) })),
)
const fps = computed({
  get: () => String(store.exportSettings.fps),
  set: v => {
    store.exportSettings.fps = Number(v)
  },
})
</script>

<template>
  <aside class="flex flex-col min-h-0 bg-background overflow-y-auto lg:overflow-y-hidden">
    <!-- On desktop this section scrolls on its own (the panel height is fixed), so
         the controls never clip as more are added; on mobile the whole aside
         scrolls. -->
    <div
      class="max-lg:shrink-0 lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-4 space-y-4 border-b border-border"
    >
      <!-- Redundant on mobile: the bottom tab bar already labels this section. -->
      <h2
        class="hidden lg:flex items-center gap-2 font-mono text-[11px] uppercase text-muted-foreground"
      >
        <UploadIcon class="size-3.5 text-brand" />
        {{ $t('media.heading') }}
      </h2>

      <ZtudioField :label="$t('media.resolution')">
        <ZtudioSelectField v-model="store.resolution" :options="resolutionOptions" />
      </ZtudioField>

      <div class="grid grid-cols-3 gap-3">
        <ZtudioField :label="$t('export.quality')">
          <ZtudioSelectField v-model="store.exportSettings.quality" :options="qualityOptions" />
        </ZtudioField>
        <ZtudioField :label="$t('export.format')">
          <ZtudioSelectField v-model="store.exportSettings.format" :options="formatOptions" />
        </ZtudioField>
        <ZtudioField :label="$t('export.fps')">
          <ZtudioSelectField v-model="fps" :options="fpsOptions" />
        </ZtudioField>
      </div>

      <Tabs default-value="audio" class="gap-0">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="audio">{{ $t('media.tabAudio') }}</TabsTrigger>
          <TabsTrigger value="image">{{ $t('media.tabImage') }}</TabsTrigger>
          <TabsTrigger value="caption">{{ $t('media.tabCaption') }}</TabsTrigger>
        </TabsList>

        <TabsContent value="audio" class="space-y-4 pt-4">
          <ZtudioMediaUploader
            accept="audio/*"
            :title="$t('media.audio')"
            :icon="MusicIcon"
            :ok="store.audioPill.ok"
            :status="store.audioPill.text"
            @select="store.loadAudio($event)"
            @clear="store.loadAudio(null)"
          />
          <ZtudioAudioControls />
        </TabsContent>

        <TabsContent value="image" class="pt-4">
          <ZtudioMediaUploader
            accept="image/*"
            multiple
            :title="$t('media.image')"
            :hint="$t('media.imageHint')"
            :icon="ImageIcon"
            :ok="store.imagePill.ok"
            :status="store.imagePill.text"
            @select="store.addImages($event)"
            @clear="store.clearImages()"
          />
        </TabsContent>

        <TabsContent value="caption" class="pt-4">
          <ZtudioMediaUploader
            accept=".srt,text/plain"
            :title="$t('media.captions')"
            :icon="CaptionsIcon"
            :ok="store.srtPill.ok"
            :status="store.srtPill.text"
            @select="store.loadSrt($event)"
            @clear="store.loadSrt(null)"
          />
        </TabsContent>
      </Tabs>

      <ZtudioReadinessPills />
    </div>
    <ZtudioActivityLog class="h-64 shrink-0 lg:h-80" />
  </aside>
</template>
