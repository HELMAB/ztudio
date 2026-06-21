<script setup>
import { computed, ref, watch } from 'vue'
import { FIT_OPTIONS, IMAGE_EFFECTS } from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const localize = options =>
  computed(() => options.map(o => ({ value: o.value, label: t(o.labelKey) })))

const fitOptions = localize(FIT_OPTIONS)
const effectOptions = localize(IMAGE_EFFECTS)

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
    </template>

    <p v-else-if="store.hasImages" class="text-xs text-muted-foreground">
      {{ $t('controls.selectImageHint') }}
    </p>

    <p v-else class="text-xs text-muted-foreground">
      {{ $t('controls.noImagesHint') }}
    </p>
  </div>
</template>
