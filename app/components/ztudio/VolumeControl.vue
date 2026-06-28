<script setup>
import { computed } from 'vue'
import { Volume1Icon, Volume2Icon, VolumeXIcon } from '@lucide/vue'

// Preview-monitor volume + mute. The toolbar shows only a speaker icon; hovering
// (or focusing) it reveals a popover with the slider and a percentage readout, so
// the transport bar stays uncluttered. The level shapes only what you hear while
// previewing — never the exported mix.
const store = useZtudioStore()
const { t } = useI18n()

// The slider tracks the real level, but reads 0 while muted so it mirrors what you
// actually hear.
const level = computed(() => (store.muted ? 0 : store.previewVolume))
const readout = computed(() =>
  store.muted ? t('transport.muted') : Math.round(store.previewVolume * 100) + '%',
)

// Setting a level always lifts mute, so the slider both reflects and controls
// what you hear.
function setVolume(v) {
  store.previewVolume = Math.min(1, Math.max(0, v))
  if (store.previewVolume > 0 && store.muted) {
    store.muted = false
  }
}

// Scroll over the control to nudge the level (classic media-player gesture).
function onWheel(e) {
  e.preventDefault()
  setVolume(store.previewVolume + (e.deltaY < 0 ? 0.05 : -0.05))
}
</script>

<template>
  <div class="group/vol relative shrink-0" @wheel="onWheel">
    <Button
      size="icon"
      variant="ghost"
      class="size-7 text-neutral-300"
      :aria-label="store.muted ? $t('transport.unmute') : $t('transport.mute')"
      :aria-pressed="store.muted"
      :title="store.muted ? $t('transport.unmute') : $t('transport.mute')"
      data-testid="transport-mute"
      @click="store.toggleMute()"
    >
      <VolumeXIcon v-if="store.muted || store.previewVolume === 0" class="size-4" />
      <Volume1Icon v-else-if="store.previewVolume < 0.5" class="size-4" />
      <Volume2Icon v-else class="size-4" />
    </Button>

    <!-- Popover sits directly above the button (bottom-full ⇒ no hover gap) and
         opens on hover or keyboard focus. -->
    <div
      class="absolute bottom-full left-1/2 z-30 hidden w-36 -translate-x-1/2 flex-col gap-2 rounded-md border border-neutral-700 bg-neutral-900/95 p-3 shadow-xl backdrop-blur-sm group-hover/vol:flex group-focus-within/vol:flex"
      data-testid="volume-popover"
    >
      <div class="flex items-center justify-between font-mono text-[10px] text-neutral-400">
        <span>{{ $t('transport.volume') }}</span>
        <span class="tabular-nums text-neutral-200" data-testid="volume-readout">{{
          readout
        }}</span>
      </div>
      <Slider
        :model-value="[level]"
        :min="0"
        :max="1"
        :step="0.05"
        :aria-label="$t('transport.volume')"
        data-testid="transport-volume"
        @update:model-value="setVolume($event[0])"
      />
    </div>
  </div>
</template>
