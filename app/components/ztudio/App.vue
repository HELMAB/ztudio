<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'

const store = useZtudioStore()

// Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Skipped while typing in
// a field so native text undo is left intact.
function onKeydown(e) {
  if (!(e.ctrlKey || e.metaKey)) {
    return
  }
  const el = e.target
  if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) {
    return
  }
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    store.redo()
  }
}

// The three-panel editor needs real horizontal room; below `lg` we switch to a
// single-column, tab-driven workspace instead.
const isDesktop = useMediaQuery('(min-width: 1024px)')

// Branded splash stays up until init (fonts + demo media + env check) resolves.
const ready = ref(false)

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    await store.init()
  } finally {
    ready.value = true
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
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
