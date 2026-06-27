<script setup>
import { onBeforeUnmount, watch } from 'vue'

const store = useZtudioStore()

function dismiss() {
  store.closeContextMenu()
}

function onKey(e) {
  if (e.key === 'Escape') {
    dismiss()
  }
}

function addListeners() {
  window.addEventListener('pointerdown', dismiss)
  window.addEventListener('wheel', dismiss, { passive: true })
  window.addEventListener('blur', dismiss)
  window.addEventListener('keydown', onKey)
}

function removeListeners() {
  window.removeEventListener('pointerdown', dismiss)
  window.removeEventListener('wheel', dismiss)
  window.removeEventListener('blur', dismiss)
  window.removeEventListener('keydown', onKey)
}

// Attach the outside-dismiss listeners only while open, deferred a tick so the
// opening right-click doesn't immediately close the menu.
watch(
  () => store.contextMenu.open,
  open => {
    removeListeners()
    if (open) {
      setTimeout(addListeners, 0)
    }
  },
)

onBeforeUnmount(removeListeners)

function run(item) {
  store.closeContextMenu()
  item.action?.()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.contextMenu.open"
      class="fixed z-[60] min-w-44 overflow-hidden rounded-md border border-border bg-background py-1 shadow-xl"
      :style="{ left: store.contextMenu.x + 'px', top: store.contextMenu.y + 'px' }"
      @contextmenu.prevent
      @pointerdown.stop
    >
      <template v-for="(item, i) in store.contextMenu.items" :key="i">
        <div v-if="item.separator" class="my-1 h-px bg-border" />
        <button
          v-else
          type="button"
          class="flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
          :class="item.danger ? 'text-red-600' : 'text-foreground'"
          @click="run(item)"
        >
          {{ item.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>
