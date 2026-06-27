<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { UploadIcon } from '@lucide/vue'

const store = useZtudioStore()
const dragging = ref(false)

// Only react to file drags (ignore in-app element drags, text selections, etc.).
const hasFiles = e => Array.from(e.dataTransfer?.types || []).includes('Files')

function onDragOver(e) {
  if (!hasFiles(e)) {
    return
  }
  // preventDefault is required for the drop event to fire at all.
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
  dragging.value = true
}

function onDragLeave(e) {
  // relatedTarget is null only when the cursor actually leaves the window, so the
  // overlay doesn't flicker as the drag moves between child elements.
  if (e.relatedTarget === null) {
    dragging.value = false
  }
}

function onDrop(e) {
  if (!hasFiles(e)) {
    dragging.value = false
    return
  }
  e.preventDefault()
  dragging.value = false
  store.importFiles(e.dataTransfer.files)
}

onMounted(() => {
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="dragging"
        class="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
      >
        <div
          class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand bg-background/60 px-10 py-12 text-center"
        >
          <UploadIcon class="size-10 text-brand" />
          <p class="text-base font-semibold text-foreground">{{ $t('dropzone.title') }}</p>
          <p class="max-w-xs text-sm text-muted-foreground">{{ $t('dropzone.hint') }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
