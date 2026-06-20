<script setup>
import { computed } from 'vue'
import {
  FIT_OPTIONS,
  POSITION_OPTIONS,
  PRESET_OPTIONS,
  WEIGHT_OPTIONS,
} from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const localize = options => computed(() => options.map(o => ({ value: o.value, label: t(o.labelKey) })))

const presetOptions = localize(PRESET_OPTIONS)
const weightOptions = localize(WEIGHT_OPTIONS)
const positionOptions = localize(POSITION_OPTIONS)
const fitOptions = localize(FIT_OPTIONS)

function onFont(event) {
  store.loadFont(event.target.files[0])
  event.target.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <ZtudioField :label="$t('controls.preset')">
      <ZtudioSelectField v-model="store.preset" :options="presetOptions" />
    </ZtudioField>

    <ZtudioField :label="$t('controls.font')">
      <ZtudioSelectField v-model="store.controls.fontKey" :options="store.fontOptions" />
    </ZtudioField>

    <ZtudioFileInput
      :label="$t('controls.uploadFont')"
      accept=".ttf,.otf,font/ttf,font/otf"
      @select="onFont"
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

    <ZtudioField :label="$t('controls.imageFit')">
      <ZtudioSelectField v-model="store.controls.imageFit" :options="fitOptions" />
    </ZtudioField>

    <ZtudioField :label="$t('controls.background')">
      <label class="flex items-center gap-2.5 text-sm py-1.5 select-none">
        <Checkbox v-model="store.controls.box" /> {{ $t('controls.boxBehindText') }}
      </label>
    </ZtudioField>
  </div>
</template>
