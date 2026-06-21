<script setup>
import { computed, ref, watch } from 'vue'
import { TypeIcon } from '@lucide/vue'
import { FIT_OPTIONS, POSITION_OPTIONS, PRESET_OPTIONS, WEIGHT_OPTIONS } from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const localize = options =>
  computed(() => options.map(o => ({ value: o.value, label: t(o.labelKey) })))

const presetOptions = localize(PRESET_OPTIONS)
const weightOptions = localize(WEIGHT_OPTIONS)
const positionOptions = localize(POSITION_OPTIONS)
const fitOptions = localize(FIT_OPTIONS)

const showFontUploader = ref(false)
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

// Reveal the uploader automatically when there are custom fonts
// (e.g. restored from a previous session).
watch(
  () => store.customFonts.length,
  count => {
    if (count > 0) {
      showFontUploader.value = true
    }
  },
  { immediate: true },
)

function onFont(files) {
  store.loadFonts(files)
}
</script>

<template>
  <div class="space-y-4">
    <ZtudioField :label="$t('controls.preset')">
      <ZtudioSelectField v-model="store.preset" :options="presetOptions" />
    </ZtudioField>

    <ZtudioField :label="$t('controls.font')">
      <ZtudioComboboxField v-model="store.controls.fontKey" :options="store.fontOptions" />
    </ZtudioField>

    <ZtudioField :label="$t('controls.customFont')">
      <label class="flex items-center gap-2.5 text-sm py-1.5 select-none">
        <Switch v-model="showFontUploader" /> {{ $t('controls.customFontToggle') }}
      </label>
    </ZtudioField>

    <ZtudioMediaUploader
      v-if="showFontUploader"
      accept=".ttf,.otf,font/ttf,font/otf"
      multiple
      :title="$t('controls.uploadFont')"
      :icon="TypeIcon"
      :ok="store.fontPill.ok"
      :status="store.fontPill.text"
      @select="onFont"
      @clear="store.clearCustomFonts()"
    />

    <ZtudioField :label="$t('controls.fontSize')" :value="store.sizeLabel">
      <Slider
        :model-value="[store.controls.fontSizePct]"
        :min="0.03"
        :max="0.1"
        :step="0.0025"
        @update:model-value="store.controls.fontSizePct = $event[0]"
      />
    </ZtudioField>

    <ZtudioField :label="$t('controls.weight')">
      <ZtudioSelectField v-model="store.controls.fontWeight" :options="weightOptions" />
    </ZtudioField>

    <div class="grid grid-cols-2 gap-3">
      <ZtudioField :label="$t('controls.textColour')">
        <input
          v-model="store.controls.fill"
          type="color"
          class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
        />
      </ZtudioField>
      <ZtudioField :label="$t('controls.outlineColour')">
        <input
          v-model="store.controls.strokeColor"
          type="color"
          class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
        />
      </ZtudioField>
    </div>

    <ZtudioField :label="$t('controls.outlineWidth')" :value="store.strokeLabel">
      <Slider
        :model-value="[store.controls.strokePct]"
        :min="0"
        :max="0.3"
        :step="0.02"
        @update:model-value="store.controls.strokePct = $event[0]"
      />
    </ZtudioField>

    <ZtudioField :label="$t('controls.position')">
      <ZtudioSelectField v-model="store.controls.position" :options="positionOptions" />
    </ZtudioField>

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

    <ZtudioField :label="$t('controls.background')">
      <label class="flex items-center gap-2.5 text-sm py-1.5 select-none">
        <Checkbox v-model="store.controls.box" /> {{ $t('controls.boxBehindText') }}
      </label>
    </ZtudioField>
  </div>
</template>
