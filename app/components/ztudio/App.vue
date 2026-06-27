<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'

const store = useZtudioStore()

// True for fields/controls that own arrow/space/typing keys, so global shortcuts
// never steal them (text inputs, selects, sliders, comboboxes, menus).
function isEditable(el) {
  if (!el) {
    return false
  }
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
    return true
  }
  return !!el.closest?.('[role="slider"], [role="combobox"], [role="listbox"], [role="menu"]')
}

// Editor keyboard shortcuts. Ctrl/Cmd+Z/Y handle history (left intact while typing
// so native text undo works); the rest are single-key transport/editing commands
// that are suppressed while typing, while a slider/select is focused, and while a
// modal (caption dialog / result) is open. See ZtudioShortcutsOverlay for the list.
function onKeydown(e) {
  const el = e.target

  if (e.ctrlKey || e.metaKey) {
    if (isEditable(el)) {
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
    return
  }

  // While the shortcuts overlay is open, only allow closing it.
  if (store.showShortcuts) {
    if (e.key === 'Escape' || e.key === '?') {
      e.preventDefault()
      store.showShortcuts = false
    }
    return
  }

  if (isEditable(el) || store.captionDialog.open || store.result) {
    return
  }

  const FRAME = 1 / 30
  switch (e.key) {
    case ' ':
      // Let a focused button handle Space natively (e.g. activate it).
      if (el?.tagName === 'BUTTON') {
        return
      }
      e.preventDefault()
      store.togglePlay()
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (e.shiftKey) {
        store.jumpCue(-1)
      } else {
        store.nudge(e.altKey ? -1 : -FRAME)
      }
      break
    case 'ArrowRight':
      e.preventDefault()
      if (e.shiftKey) {
        store.jumpCue(1)
      } else {
        store.nudge(e.altKey ? 1 : FRAME)
      }
      break
    case 'Home':
      e.preventDefault()
      store.seek(0)
      break
    case 'End':
      e.preventDefault()
      store.seek(store.previewDuration)
      break
    case 'Delete':
    case 'Backspace':
      if (store.deleteSelected()) {
        e.preventDefault()
      }
      break
    case '+':
    case '=':
      e.preventDefault()
      store.zoomTimeline('in')
      break
    case '-':
    case '_':
      e.preventDefault()
      store.zoomTimeline('out')
      break
    case '0':
      e.preventDefault()
      store.zoomTimeline('fit')
      break
    case '?':
      e.preventDefault()
      store.showShortcuts = true
      break
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
    <ZtudioShortcutsOverlay />

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
