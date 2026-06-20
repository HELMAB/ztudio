<script setup>
import {
  FIT_OPTIONS,
  POSITION_OPTIONS,
  PRESET_OPTIONS,
  WEIGHT_OPTIONS,
} from '@/lib/greenroom/config'

const store = useGreenroom()

function onFont(event) {
  store.loadFont(event.target.files[0])
  event.target.value = ''
}
</script>

<template>
  <div class="grid grid-cols-2 gap-4">
    <div class="col-span-2">
      <GreenroomField label="Preset style">
        <GreenroomSelectField v-model="store.preset" :options="PRESET_OPTIONS" />
      </GreenroomField>
    </div>

    <GreenroomField label="Caption font">
      <GreenroomSelectField v-model="store.controls.fontKey" :options="store.fontOptions" />
    </GreenroomField>

    <GreenroomFileInput
      label="Upload font (.ttf/.otf)"
      accept=".ttf,.otf,font/ttf,font/otf"
      @select="onFont"
    />

    <GreenroomField label="Font size" :value="store.sizeLabel">
      <Slider
        :model-value="[store.controls.fontSizePct]"
        :min="0.03"
        :max="0.1"
        :step="0.0025"
        @update:model-value="store.controls.fontSizePct = $event[0]"
      />
    </GreenroomField>

    <GreenroomField label="Weight">
      <GreenroomSelectField v-model="store.controls.fontWeight" :options="WEIGHT_OPTIONS" />
    </GreenroomField>

    <GreenroomField label="Text colour">
      <input
        v-model="store.controls.fill"
        type="color"
        class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
      />
    </GreenroomField>

    <GreenroomField label="Outline colour">
      <input
        v-model="store.controls.strokeColor"
        type="color"
        class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
      />
    </GreenroomField>

    <GreenroomField label="Outline width" :value="store.strokeLabel">
      <Slider
        :model-value="[store.controls.strokePct]"
        :min="0"
        :max="0.3"
        :step="0.02"
        @update:model-value="store.controls.strokePct = $event[0]"
      />
    </GreenroomField>

    <GreenroomField label="Position">
      <GreenroomSelectField v-model="store.controls.position" :options="POSITION_OPTIONS" />
    </GreenroomField>

    <GreenroomField label="Background">
      <label class="flex items-center gap-2.5 text-sm py-1.5 select-none">
        <Checkbox v-model="store.controls.box" /> Box behind text
      </label>
    </GreenroomField>

    <GreenroomField label="Image fit">
      <GreenroomSelectField v-model="store.controls.imageFit" :options="FIT_OPTIONS" />
    </GreenroomField>

    <div class="col-span-2">
      <GreenroomField label="Timeline" :value="store.timeLabel">
        <Slider
          :model-value="[store.scrub]"
          :min="0"
          :max="store.previewDuration"
          :step="0.1"
          @update:model-value="store.scrub = $event[0]"
        />
      </GreenroomField>
    </div>
  </div>
</template>
