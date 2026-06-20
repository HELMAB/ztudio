<script setup>
import { TypeIcon } from '@lucide/vue'
</script>

<template>
  <section class="border-t border-border py-10">
    <GreenroomSectionHeading :icon="TypeIcon">Caption</GreenroomSectionHeading>
    <div class="flex flex-wrap gap-8 items-start">
      <GreenroomCaptionPreview class="flex-none" />
      <GreenroomCaptionControls class="flex-1 min-w-[300px]" />
    </div>
  </section>
</template>
