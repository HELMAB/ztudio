<script setup>
import { onMounted, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'

const store = useZtudioStore()

// The three-panel editor needs real horizontal room; below `lg` we switch to a
// single-column, tab-driven workspace instead.
const isDesktop = useMediaQuery('(min-width: 1024px)')

// Branded splash stays up until init (fonts + demo media + env check) resolves.
const ready = ref(false)

onMounted(async () => {
  try {
    await store.init()
  } finally {
    ready.value = true
  }
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
    <ZtudioCaptionDialog />

    <Transition
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-500"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <ZtudioSplash v-if="!ready" />
    </Transition>
  </div>
</template>
