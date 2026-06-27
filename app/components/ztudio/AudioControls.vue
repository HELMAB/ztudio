<script setup>
import { computed } from 'vue'
import { Music2Icon } from '@lucide/vue'

const store = useZtudioStore()

const pct = v => Math.round(v * 100) + '%'
const secs = v => v.toFixed(1) + 's'

const voiceGainLabel = computed(() => pct(store.audio.voiceGain))
const musicGainLabel = computed(() => pct(store.audio.musicGain))
const duckLabel = computed(() => pct(store.audio.duckAmount))
</script>

<template>
  <div class="space-y-4">
    <!-- Voice (primary track) -->
    <ZtudioField :label="$t('audio.voiceVolume')" :value="voiceGainLabel">
      <Slider
        :model-value="[store.audio.voiceGain]"
        :min="0"
        :max="2"
        :step="0.05"
        @update:model-value="store.audio.voiceGain = $event[0]"
      />
    </ZtudioField>

    <div class="grid grid-cols-2 gap-3">
      <ZtudioField :label="$t('audio.fadeIn')" :value="secs(store.audio.voiceFadeIn)">
        <Slider
          :model-value="[store.audio.voiceFadeIn]"
          :min="0"
          :max="5"
          :step="0.1"
          @update:model-value="store.audio.voiceFadeIn = $event[0]"
        />
      </ZtudioField>
      <ZtudioField :label="$t('audio.fadeOut')" :value="secs(store.audio.voiceFadeOut)">
        <Slider
          :model-value="[store.audio.voiceFadeOut]"
          :min="0"
          :max="5"
          :step="0.1"
          @update:model-value="store.audio.voiceFadeOut = $event[0]"
        />
      </ZtudioField>
    </div>

    <!-- Background music bed -->
    <ZtudioMediaUploader
      accept="audio/*"
      :title="$t('audio.music')"
      :hint="$t('audio.musicHint')"
      :icon="Music2Icon"
      :ok="store.musicPill.ok"
      :status="store.musicPill.text"
      @select="store.loadMusic($event)"
      @clear="store.loadMusic(null)"
    />

    <template v-if="store.hasMusic">
      <ZtudioField :label="$t('audio.musicVolume')" :value="musicGainLabel">
        <Slider
          :model-value="[store.audio.musicGain]"
          :min="0"
          :max="1.5"
          :step="0.05"
          @update:model-value="store.audio.musicGain = $event[0]"
        />
      </ZtudioField>

      <div class="grid grid-cols-2 gap-3">
        <ZtudioField :label="$t('audio.fadeIn')" :value="secs(store.audio.musicFadeIn)">
          <Slider
            :model-value="[store.audio.musicFadeIn]"
            :min="0"
            :max="8"
            :step="0.1"
            @update:model-value="store.audio.musicFadeIn = $event[0]"
          />
        </ZtudioField>
        <ZtudioField :label="$t('audio.fadeOut')" :value="secs(store.audio.musicFadeOut)">
          <Slider
            :model-value="[store.audio.musicFadeOut]"
            :min="0"
            :max="8"
            :step="0.1"
            @update:model-value="store.audio.musicFadeOut = $event[0]"
          />
        </ZtudioField>
      </div>

      <ZtudioField :label="$t('audio.loop')">
        <label class="flex items-center gap-2.5 text-sm py-1.5 select-none">
          <Switch v-model="store.audio.musicLoop" /> {{ $t('audio.loopHint') }}
        </label>
      </ZtudioField>

      <ZtudioField :label="$t('audio.ducking')">
        <label class="flex items-center gap-2.5 text-sm py-1.5 select-none">
          <Switch v-model="store.audio.ducking" /> {{ $t('audio.duckingHint') }}
        </label>
      </ZtudioField>

      <ZtudioField
        v-if="store.audio.ducking"
        :label="$t('audio.duckAmount')"
        :value="duckLabel"
      >
        <Slider
          :model-value="[store.audio.duckAmount]"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="store.audio.duckAmount = $event[0]"
        />
      </ZtudioField>
    </template>
  </div>
</template>
