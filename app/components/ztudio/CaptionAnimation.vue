<script setup>
import { computed } from 'vue'
import { DiamondPlusIcon, Trash2Icon } from '@lucide/vue'
import { ANIMATION_OPTIONS } from '@/lib/ztudio/config'
import { OVERLAY_OPTIONS } from '@/lib/ztudio/overlays'
import { EASING_KEYS } from '@/lib/ztudio/keyframes'

const store = useZtudioStore()
const { t } = useI18n()

const animationOptions = computed(() =>
  ANIMATION_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })),
)

const overlayOptions = computed(() =>
  OVERLAY_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })),
)

const overlayActive = computed(() => store.controls.overlay !== 'none')
const overlayIntensityLabel = computed(
  () => Math.round(store.controls.overlayIntensity * 100) + '%',
)

const easingOptions = computed(() =>
  EASING_KEYS.map(key => ({ value: key, label: t(`easing.${key}`) })),
)

const sortedKeyframes = computed(() => [...store.keyframes].sort((a, b) => a.t - b.t))

function fmtTime(s) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}
</script>

<template>
  <div class="space-y-4">
    <ZtudioField :label="$t('controls.animation')">
      <ZtudioSelectField v-model="store.controls.animation" :options="animationOptions" />
    </ZtudioField>

    <div class="pt-2 border-t border-border space-y-3">
      <span class="font-mono text-[11px] uppercase text-muted-foreground">
        {{ $t('overlay.heading') }}
      </span>

      <ZtudioField :label="$t('controls.overlay')">
        <ZtudioSelectField v-model="store.controls.overlay" :options="overlayOptions" />
      </ZtudioField>

      <ZtudioField
        v-if="overlayActive"
        :label="$t('controls.overlayIntensity')"
        :value="overlayIntensityLabel"
      >
        <Slider
          :model-value="[store.controls.overlayIntensity]"
          :min="0.3"
          :max="2"
          :step="0.1"
          @update:model-value="store.controls.overlayIntensity = $event[0]"
        />
      </ZtudioField>

      <p v-if="overlayActive" class="text-xs text-muted-foreground">{{ $t('overlay.hint') }}</p>
    </div>

    <div class="pt-2 border-t border-border space-y-3">
      <div class="flex items-center justify-between">
        <span class="font-mono text-[11px] uppercase text-muted-foreground">
          {{ $t('keyframe.heading') }}
        </span>
        <Button
          v-if="store.hasKeyframes"
          size="sm"
          variant="ghost"
          class="h-7 text-xs text-muted-foreground"
          @click="store.clearKeyframes()"
        >
          {{ $t('keyframe.clear') }}
        </Button>
      </div>

      <p class="text-xs text-muted-foreground">{{ $t('keyframe.hint') }}</p>

      <Button size="sm" variant="secondary" class="w-full" @click="store.addKeyframe()">
        <DiamondPlusIcon class="size-4" />
        {{ $t('keyframe.addAt', { time: fmtTime(store.scrub) }) }}
      </Button>

      <ul v-if="store.hasKeyframes" class="space-y-1.5">
        <li
          v-for="kf in sortedKeyframes"
          :key="kf.id"
          class="flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors"
          :class="
            kf.id === store.selectedKeyframeId
              ? 'border-brand bg-brand/10'
              : 'border-border'
          "
        >
          <button
            type="button"
            class="font-mono text-xs tabular-nums shrink-0 hover:text-brand"
            @click="store.selectKeyframe(kf.id)"
          >
            {{ fmtTime(kf.t) }}
          </button>
          <ZtudioSelectField
            class="flex-1 min-w-0"
            :model-value="kf.easing"
            :options="easingOptions"
            @update:model-value="store.setKeyframeEasing(kf.id, $event)"
          />
          <Button
            size="icon"
            variant="ghost"
            class="size-7 shrink-0 text-muted-foreground hover:text-red-600"
            :aria-label="$t('keyframe.delete')"
            @click="store.removeKeyframe(kf.id)"
          >
            <Trash2Icon class="size-3.5" />
          </Button>
        </li>
      </ul>
    </div>
  </div>
</template>
