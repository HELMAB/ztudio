<script setup>
import { onMounted } from 'vue'
import { useMediaQuery } from '@vueuse/core'

const store = useZtudioStore()

// The three-panel editor needs real horizontal room; below `lg` we switch to a
// single-column, tab-driven workspace instead.
const isDesktop = useMediaQuery('(min-width: 1024px)')

onMounted(() => {
  store.init()
})
</script>

<template>
  <div
    class="flex flex-col h-dvh w-full overflow-hidden bg-background text-foreground font-sans antialiased"
  >
    <ZtudioTopBar />
    <ZtudioDesktopWorkspace v-if="isDesktop" />
    <ZtudioMobileWorkspace v-else />
    <ZtudioResultOverlay />
  </div>
</template>
