<script setup>
const store = useGreenroom()
</script>

<template>
  <div class="grid sm:grid-cols-2 gap-4">
    <div>
      <video :src="store.result.url" controls playsinline class="block w-full max-w-[260px] border border-border" />
    </div>
    <div>
      <GreenroomPill :ok="true">{{ store.result.label }}</GreenroomPill>
      <p class="text-sm text-muted-foreground mt-2">
        {{ store.result.sizeMB }} MB · {{ store.result.dur }}s ·
        <template v-if="store.result.frames != null">{{ store.result.frames }} frames · </template>{{ store.result.ratio }}× realtime
      </p>
      <a
        :href="store.result.url"
        :download="`caption-video.${store.result.ext}`"
        class="inline-block mt-2.5 font-semibold text-[#00b140] border-b border-[#00b140] pb-px"
      >↓ Download caption-video.{{ store.result.ext }}</a>
    </div>
  </div>
</template>
