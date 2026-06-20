<script setup>
import { RESOLUTION_OPTIONS } from '@/lib/greenroom/config'

const store = useGreenroom()

async function onAudio(event) {
  const ok = await store.loadAudio(event.target.files[0])
  if (!ok) {
    event.target.value = ''
  }
}

function onImage(event) {
  store.loadImage(event.target.files[0])
}

function onSrt(event) {
  store.loadSrt(event.target.files[0])
}
</script>

<template>
  <section class="border-t border-border py-10">
    <GreenroomSectionHeading>Source</GreenroomSectionHeading>
    <div class="grid sm:grid-cols-2 gap-5">
      <GreenroomField label="Aspect & resolution">
        <GreenroomSelectField v-model="store.resolution" :options="RESOLUTION_OPTIONS" />
      </GreenroomField>
      <GreenroomFileInput label="Audio — required, max 5:00" accept="audio/*" @select="onAudio" />
      <GreenroomFileInput label="Image — optional" accept="image/*" @select="onImage" />
      <GreenroomFileInput
        label="Captions — optional, .srt"
        accept=".srt,text/plain"
        @select="onSrt"
      />
    </div>
    <GreenroomReadinessPills />
  </section>
</template>
