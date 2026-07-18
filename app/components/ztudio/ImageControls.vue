<script setup>
import { computed, ref, watch } from 'vue'
import {
  BACKGROUND_OPTIONS,
  FIT_OPTIONS,
  IMAGE_EFFECTS,
  TRANSITION_OPTIONS,
} from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const localize = options =>
  computed(() => options.map(o => ({ value: o.value, label: t(o.labelKey) })))

const fitOptions = localize(FIT_OPTIONS)
const effectOptions = localize(IMAGE_EFFECTS)
const transitionOptions = localize(TRANSITION_OPTIONS)
const backgroundOptions = localize(BACKGROUND_OPTIONS)

const transitionLabel = computed(() => store.controls.transitionDuration.toFixed(1) + 's')
const secs = v => v.toFixed(1) + 's'
// Solid + gradient background modes expose colour pickers (gradient adds a second
// stop); 'blur' derives its fill from the image, so no picker is shown.
const showBgColor = computed(() => ['color', 'gradient'].includes(store.controls.bgMode))

const showCrop = ref(false)

// Crop sliders track the selected clip: open them when that clip is already cropped.
watch(
  () => store.selectedImageId,
  () => {
    showCrop.value = store.selectedImageHasCrop
  },
  { immediate: true },
)

function onToggleCrop(on) {
  showCrop.value = on
  if (!on) {
    store.resetImageCrop()
  }
}

const pct = v => Math.round(v * 100) + '%'
</script>

<template>
  <div class="space-y-4">
    <!-- Scene background: fills letterboxed bars behind contained images and any
         gaps. Applies whether or not images are present. -->
    <ZtudioField :label="$t('controls.bgMode')">
      <ZtudioSelectField v-model="store.controls.bgMode" :options="backgroundOptions" />
    </ZtudioField>

    <div v-if="showBgColor" class="grid grid-cols-2 gap-3">
      <ZtudioField :label="$t('controls.bgColor')">
        <input
          v-model="store.controls.bgColor"
          type="color"
          class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
        />
      </ZtudioField>
      <ZtudioField v-if="store.controls.bgMode === 'gradient'" :label="$t('controls.bgColor2')">
        <input
          v-model="store.controls.bgColor2"
          type="color"
          class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
        />
      </ZtudioField>
    </div>

    <div class="border-t border-border" />

    <!-- Global slideshow setting: applies to every clip boundary, so it lives
         outside the per-clip block below. -->
    <template v-if="store.hasImages">
      <ZtudioField :label="$t('controls.transition')">
        <ZtudioSelectField v-model="store.controls.transition" :options="transitionOptions" />
      </ZtudioField>

      <ZtudioField
        v-if="store.controls.transition !== 'none'"
        :label="$t('controls.transitionDuration')"
        :value="transitionLabel"
      >
        <Slider
          :model-value="[store.controls.transitionDuration]"
          :min="0.2"
          :max="2"
          :step="0.1"
          @update:model-value="store.controls.transitionDuration = $event[0]"
        />
      </ZtudioField>

      <div class="border-t border-border" />
    </template>

    <template v-if="store.selectedImage">
      <p class="font-mono text-[11px] uppercase text-brand truncate">
        {{ $t('controls.editingImage', { name: store.selectedImage.name }) }}
      </p>

      <ZtudioField :label="$t('controls.imageFit')">
        <ZtudioSelectField
          :model-value="store.selectedImage.fit"
          :options="fitOptions"
          @update:model-value="store.setImageFit($event)"
        />
      </ZtudioField>

      <ZtudioField :label="$t('controls.imageEffect')">
        <ZtudioSelectField
          :model-value="store.selectedImage.effect"
          :options="effectOptions"
          @update:model-value="store.setImageEffect($event)"
        />
      </ZtudioField>

      <ZtudioField :label="$t('controls.imageZoom')" :value="store.imageZoomLabel">
        <Slider
          :model-value="[store.selectedImage.zoom]"
          :min="0.5"
          :max="4"
          :step="0.05"
          @update:model-value="store.setImageZoom($event[0])"
        />
      </ZtudioField>

      <ZtudioField
        :label="$t('controls.imageRotation')"
        :value="Math.round(store.selectedImage.rotation || 0) + '°'"
      >
        <Slider
          :model-value="[store.selectedImage.rotation || 0]"
          :min="-180"
          :max="180"
          :step="1"
          @update:model-value="store.setImageRotation($event[0])"
        />
      </ZtudioField>
      <p class="text-xs text-muted-foreground -mt-1.5">{{ $t('controls.imageDragHint') }}</p>

      <ZtudioField :label="$t('controls.cropImage')">
        <label class="flex items-center gap-2.5 text-sm py-1.5 select-none">
          <Switch :model-value="showCrop" @update:model-value="onToggleCrop" />
          {{ $t('controls.cropToggle') }}
        </label>
      </ZtudioField>

      <template v-if="showCrop">
        <div class="grid grid-cols-2 gap-3">
          <ZtudioField :label="$t('controls.cropTop')" :value="pct(store.selectedImage.cropTop)">
            <Slider
              :model-value="[store.selectedImage.cropTop]"
              :min="0"
              :max="0.45"
              :step="0.01"
              @update:model-value="store.setImageCrop('cropTop', $event[0])"
            />
          </ZtudioField>
          <ZtudioField
            :label="$t('controls.cropBottom')"
            :value="pct(store.selectedImage.cropBottom)"
          >
            <Slider
              :model-value="[store.selectedImage.cropBottom]"
              :min="0"
              :max="0.45"
              :step="0.01"
              @update:model-value="store.setImageCrop('cropBottom', $event[0])"
            />
          </ZtudioField>
          <ZtudioField :label="$t('controls.cropLeft')" :value="pct(store.selectedImage.cropLeft)">
            <Slider
              :model-value="[store.selectedImage.cropLeft]"
              :min="0"
              :max="0.45"
              :step="0.01"
              @update:model-value="store.setImageCrop('cropLeft', $event[0])"
            />
          </ZtudioField>
          <ZtudioField
            :label="$t('controls.cropRight')"
            :value="pct(store.selectedImage.cropRight)"
          >
            <Slider
              :model-value="[store.selectedImage.cropRight]"
              :min="0"
              :max="0.45"
              :step="0.01"
              @update:model-value="store.setImageCrop('cropRight', $event[0])"
            />
          </ZtudioField>
        </div>
      </template>

      <div class="grid grid-cols-2 gap-3">
        <ZtudioField
          :label="$t('controls.clipFadeIn')"
          :value="secs(store.selectedImage.fadeIn || 0)"
        >
          <Slider
            :model-value="[store.selectedImage.fadeIn || 0]"
            :min="0"
            :max="3"
            :step="0.1"
            @update:model-value="store.setImageFade('fadeIn', $event[0])"
          />
        </ZtudioField>
        <ZtudioField
          :label="$t('controls.clipFadeOut')"
          :value="secs(store.selectedImage.fadeOut || 0)"
        >
          <Slider
            :model-value="[store.selectedImage.fadeOut || 0]"
            :min="0"
            :max="3"
            :step="0.1"
            @update:model-value="store.setImageFade('fadeOut', $event[0])"
          />
        </ZtudioField>
      </div>
    </template>

    <p v-else-if="store.hasImages" class="text-xs text-muted-foreground">
      {{ $t('controls.selectImageHint') }}
    </p>

    <p v-else class="text-xs text-muted-foreground">
      {{ $t('controls.noImagesHint') }}
    </p>

    <div class="border-t border-border" />

    <!-- Watermark / logo: a scene element pinned over every frame, independent of
         the image clips above, so it always shows here. -->
    <ZtudioLogoControls />
  </div>
</template>
