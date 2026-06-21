<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Trash2Icon } from '@lucide/vue'

const store = useZtudioStore()

const draft = reactive({ text: '', start: 0, end: 0 })
const textareaEl = ref(null)

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)

// Populate the draft whenever the dialog opens.
watch(
  () => store.captionDialog,
  d => {
    if (!d.open) {
      return
    }
    if (d.mode === 'edit' && store.cues[d.index]) {
      const c = store.cues[d.index]
      draft.text = c.text
      draft.start = c.start
      draft.end = c.end
    } else {
      const dur = store.previewDuration
      const s = Math.min(store.scrub, Math.max(0, dur - 1))
      draft.text = ''
      draft.start = +s.toFixed(2)
      draft.end = +Math.min(s + 2, dur).toFixed(2)
    }
    nextTick(() => {
      const el = textareaEl.value
      ;(el?.$el || el)?.focus?.()
    })
  },
  { deep: true },
)

function close() {
  store.closeCaptionDialog()
}

function save() {
  if (!draft.text.trim()) {
    return
  }
  const { mode, index } = store.captionDialog
  if (mode === 'edit') {
    store.updateCue(index, num(draft.start), num(draft.end))
    store.setCueText(index, draft.text)
  } else {
    store.addCaption(draft.text, num(draft.start), num(draft.end))
  }
  close()
}

function onDelete() {
  store.removeCue(store.captionDialog.index)
  close()
}

function onKey(e) {
  if (store.captionDialog.open && e.key === 'Escape') {
    close()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
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
        v-if="store.captionDialog.open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/50" @click="close" />
        <div
          class="relative w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-5 shadow-xl"
        >
          <h3 class="font-mono text-[11px] uppercase text-muted-foreground">
            {{
              store.captionDialog.mode === 'edit'
                ? $t('captionDialog.editTitle')
                : $t('captionDialog.addTitle')
            }}
          </h3>

          <div class="space-y-1.5">
            <Label>{{ $t('captionDialog.text') }}</Label>
            <Textarea
              ref="textareaEl"
              v-model="draft.text"
              rows="3"
              :placeholder="$t('caption.placeholder')"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label>{{ $t('captionDialog.start') }}</Label>
              <Input v-model.number="draft.start" type="number" min="0" step="0.1" />
            </div>
            <div class="space-y-1.5">
              <Label>{{ $t('captionDialog.end') }}</Label>
              <Input v-model.number="draft.end" type="number" min="0" step="0.1" />
            </div>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <Button
              v-if="store.captionDialog.mode === 'edit'"
              variant="ghost"
              class="text-red-600 hover:text-red-700"
              @click="onDelete"
            >
              <Trash2Icon class="size-4" />
              {{ $t('captionDialog.delete') }}
            </Button>
            <Button variant="ghost" class="ml-auto" @click="close">
              {{ $t('captionDialog.cancel') }}
            </Button>
            <Button :disabled="!draft.text.trim()" @click="save">
              {{ $t('captionDialog.save') }}
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
