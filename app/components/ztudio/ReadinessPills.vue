<script setup>
const store = useZtudioStore()
</script>

<template>
  <div class="mt-6 flex flex-wrap gap-1.5">
    <ZtudioPill :ok="store.audioPill.ok">{{ store.audioPill.text }}</ZtudioPill>
    <!-- Optional secondary track: shown only once added, so the default row stays
         focused on the core inputs instead of carrying a permanent "no music". -->
    <ZtudioPill v-if="store.hasMusic" :ok="store.musicPill.ok">{{ store.musicPill.text }}</ZtudioPill>
    <ZtudioPill :ok="store.imagePill.ok">{{ store.imagePill.text }}</ZtudioPill>
    <ZtudioPill :ok="store.srtPill.ok">{{ store.srtPill.text }}</ZtudioPill>
  </div>
</template>
