<script setup>
import {
  FIT_OPTIONS,
  POSITION_OPTIONS,
  PRESET_OPTIONS,
  WEIGHT_OPTIONS,
} from '@/lib/ztudio/config'

const store = useZtudioStore()

function onFont(event) {
  store.loadFont(event.target.files[0])
  event.target.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <ZtudioField label="Preset style">
      <ZtudioSelectField v-model="store.preset" :options="PRESET_OPTIONS" />
    </ZtudioField>

    <ZtudioField label="Caption font">
      <ZtudioSelectField v-model="store.controls.fontKey" :options="store.fontOptions" />
    </ZtudioField>

    <ZtudioFileInput
      label="Upload font (.ttf/.otf)"
      accept=".ttf,.otf,font/ttf,font/otf"
      @select="onFont"
    />

    <ZtudioField label="Font size" :value="store.sizeLabel">
      <Slider
        :model-value="[store.controls.fontSizePct]"
        :min="0.03"
        :max="0.1"
        :step="0.0025"
        @update:model-value="store.controls.fontSizePct = $event[0]"
      />
    </ZtudioField>

    <ZtudioField label="Weight">
      <ZtudioSelectField v-model="store.controls.fontWeight" :options="WEIGHT_OPTIONS" />
    </ZtudioField>

    <div class="grid grid-cols-2 gap-3">
      <ZtudioField label="Text colour">
        <input
          v-model="store.controls.fill"
          type="color"
          class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
        />
      </ZtudioField>
      <ZtudioField label="Outline colour">
        <input
          v-model="store.controls.strokeColor"
          type="color"
          class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
        />
      </ZtudioField>
    </div>

    <ZtudioField label="Outline width" :value="store.strokeLabel">
      <Slider
        :model-value="[store.controls.strokePct]"
        :min="0"
        :max="0.3"
        :step="0.02"
        @update:model-value="store.controls.strokePct = $event[0]"
      />
    </ZtudioField>

    <ZtudioField label="Position">
      <ZtudioSelectField v-model="store.controls.position" :options="POSITION_OPTIONS" />
    </ZtudioField>

    <ZtudioField label="Image fit">
      <ZtudioSelectField v-model="store.controls.imageFit" :options="FIT_OPTIONS" />
    </ZtudioField>

    <ZtudioField label="Background">
      <label class="flex items-center gap-2.5 text-sm py-1.5 select-none">
        <Checkbox v-model="store.controls.box" /> Box behind text
      </label>
    </ZtudioField>
  </div>
</template>
