<script setup>
const store = useGreenroomStore()
</script>

<template>
  <div class="mt-6 flex flex-wrap gap-1.5">
    <GreenroomPill :ok="store.audioPill.ok">{{ store.audioPill.text }}</GreenroomPill>
    <GreenroomPill :ok="store.imagePill.ok">{{ store.imagePill.text }}</GreenroomPill>
    <GreenroomPill :ok="store.srtPill.ok">{{ store.srtPill.text }}</GreenroomPill>
  </div>
</template>
