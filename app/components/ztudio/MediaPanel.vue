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
  <aside class="flex flex-col min-h-0 bg-background">
    <div class="shrink-0 p-4 space-y-4 border-b border-border">
      <h2 class="flex items-center gap-2 font-mono text-[11px] uppercase text-muted-foreground">
        <UploadIcon class="size-3.5 text-[#00b140]" />
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

        <TabsContent value="audio" class="pt-4">
          <ZtudioMediaUploader
            accept="audio/*"
            :title="$t('media.audio')"
            :icon="MusicIcon"
            :ok="store.audioPill.ok"
            :status="store.audioPill.text"
            @select="store.loadAudio($event)"
            @clear="store.loadAudio(null)"
          />
        </TabsContent>

        <TabsContent value="image" class="pt-4">
          <ZtudioMediaUploader
            accept="image/*"
            :title="$t('media.image')"
            :icon="ImageIcon"
            :ok="store.imagePill.ok"
            :status="store.imagePill.text"
            @select="store.loadImage($event)"
            @clear="store.loadImage(null)"
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
    <ZtudioActivityLog class="flex-1 min-h-0" />
  </aside>
</template>
