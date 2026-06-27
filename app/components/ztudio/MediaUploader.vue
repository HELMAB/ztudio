<script setup>
import { ref } from 'vue'
import { CheckIcon, XIcon } from '@lucide/vue'

const props = defineProps({
  accept: { type: String, default: '' },
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  ok: { type: Boolean, default: false },
  status: { type: String, default: '' },
  multiple: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'clear'])

const input = ref(null)

function pick(files) {
  if (files && files.length) {
    emit('select', props.multiple ? files : files[0])
  }
}

function onChange(event) {
  pick(event.target.files)
  // Reset so picking the same file again still fires a change event.
  event.target.value = ''
}
// Drag-and-drop is handled globally by ZtudioDropZone (drop anywhere, routed by
// type), so this box only needs click-to-browse.
</script>

<template>
  <div class="space-y-3">
    <input
      ref="input"
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="sr-only"
      @change="onChange"
    />

    <button
      type="button"
      class="group flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors"
      :class="
        ok
          ? 'border-brand/40 hover:border-brand/70'
          : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
      "
      @click="input?.click()"
    >
      <component
        :is="icon"
        v-if="icon"
        class="size-7 transition-colors"
        :class="ok ? 'text-brand' : 'text-muted-foreground group-hover:text-foreground'"
      />
      <span class="text-sm font-medium text-foreground">{{ title }}</span>
      <span class="text-xs text-muted-foreground">{{ $t('media.dropHint') }}</span>
    </button>

    <div
      class="flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[11px] uppercase"
      :class="ok ? 'bg-brand/10 text-brand' : 'bg-muted/40 text-muted-foreground'"
    >
      <CheckIcon v-if="ok" class="size-3.5 shrink-0" />
      <span class="truncate">{{ status }}</span>
      <button
        v-if="ok"
        type="button"
        class="ml-auto shrink-0 rounded p-0.5 hover:bg-brand/20"
        :aria-label="$t('media.clear')"
        @click="emit('clear')"
      >
        <XIcon class="size-3.5" />
      </button>
    </div>

    <p v-if="hint" class="text-xs text-muted-foreground">{{ hint }}</p>
  </div>
</template>
