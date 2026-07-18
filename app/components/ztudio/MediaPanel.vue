<script setup>
import { computed } from 'vue'
import { CaptionsIcon, ImageIcon, MusicIcon, UploadIcon } from '@lucide/vue'
import { RESOLUTION_OPTIONS } from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const resolutionOptions = computed(() =>
  RESOLUTION_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })),
)
</script>

<template>
  <aside class="flex flex-col min-h-0 bg-card overflow-y-auto lg:overflow-y-hidden">
    <!-- On desktop this section scrolls on its own (the panel height is fixed), so
         the controls never clip as more are added; on mobile the whole aside
         scrolls. -->
    <div
      class="max-lg:shrink-0 lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-4 space-y-4 border-b border-border"
    >
      <!-- Redundant on mobile: the bottom tab bar already labels this section. -->
      <h2 class="hidden lg:flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <UploadIcon class="size-3.5" />
        {{ $t('media.heading') }}
      </h2>

      <ZtudioField :label="$t('media.resolution')">
        <ZtudioSelectField v-model="store.resolution" :options="resolutionOptions" />
      </ZtudioField>

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
