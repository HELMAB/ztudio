<script setup>
import { computed } from 'vue'
import { PlusIcon, Trash2Icon, TypeIcon } from '@lucide/vue'
import { TEXT_ANCHOR_OPTIONS } from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const anchorOptions = computed(() =>
  TEXT_ANCHOR_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })),
)

const sel = computed(() => store.selectedText)

// Match a title to one of the anchor presets (or '' when freely positioned), so
// picking a preset snaps the centre while the sliders still allow fine tuning.
const selAnchor = computed(() => {
  const tx = sel.value
  if (!tx) {
    return ''
  }
  const hit = TEXT_ANCHOR_OPTIONS.find(a => a.x === tx.x && a.y === tx.y)
  return hit ? hit.value : ''
})

function setAnchor(value) {
  const a = TEXT_ANCHOR_OPTIONS.find(o => o.value === value)
  if (a && sel.value) {
    store.updateText(sel.value.id, { x: a.x, y: a.y })
  }
}

function patch(field, value) {
  if (sel.value) {
    store.updateText(sel.value.id, { [field]: value })
  }
}

const snippet = tx => {
  const line = (tx.text || '').split('\n')[0]
  return line.length > 24 ? line.slice(0, 24) + '…' : line || t('textOverlay.untitled')
}
</script>

<template>
  <div data-testid="title-controls" class="space-y-4">
    <div class="flex items-center justify-between">
      <span class="font-mono text-[11px] uppercase text-muted-foreground">
        {{ $t('textOverlay.heading') }}
      </span>
      <Button size="sm" variant="outline" class="gap-1.5" @click="store.addText()">
        <PlusIcon class="size-3.5" />
        {{ $t('textOverlay.add') }}
      </Button>
    </div>

    <div v-if="store.hasTexts" class="space-y-1.5">
      <div
        v-for="tx in store.texts"
        :key="tx.id"
        class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer transition-colors"
        :class="
          tx.id === store.selectedTextId
            ? 'border-brand/50 bg-brand/10'
            : 'border-border hover:bg-muted/40'
        "
        @click="store.selectText(tx.id)"
      >
        <TypeIcon class="size-3.5 shrink-0 text-muted-foreground" />
        <span class="truncate">{{ snippet(tx) }}</span>
        <span class="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
          {{ tx.start.toFixed(1) }}–{{ tx.end.toFixed(1) }}s
        </span>
        <button
          type="button"
          class="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
          :aria-label="$t('textOverlay.delete')"
          @click.stop="store.removeText(tx.id)"
        >
          <Trash2Icon class="size-3.5" />
        </button>
      </div>
    </div>

    <p v-else class="text-xs text-muted-foreground">{{ $t('textOverlay.empty') }}</p>

    <!-- Selected title editor -->
    <template v-if="sel">
      <div class="border-t border-border" />

      <ZtudioField :label="$t('textOverlay.text')">
        <textarea
          :value="sel.text"
          rows="2"
          class="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm"
          :placeholder="$t('textOverlay.placeholder')"
          @input="patch('text', $event.target.value)"
        />
      </ZtudioField>

      <ZtudioField :label="$t('textOverlay.font')">
        <ZtudioComboboxField
          :model-value="sel.fontKey || 'default'"
          :options="store.fontOptions"
          @update:model-value="store.setTextFont(sel.id, $event)"
        />
      </ZtudioField>

      <p class="text-xs text-muted-foreground">{{ $t('textOverlay.timingHint') }}</p>

      <ZtudioField :label="$t('textOverlay.anchor')">
        <ZtudioSelectField
          :model-value="selAnchor"
          :options="anchorOptions"
          :placeholder="$t('textOverlay.anchorCustom')"
          @update:model-value="setAnchor"
        />
      </ZtudioField>
      <p class="text-xs text-muted-foreground -mt-1.5">{{ $t('textOverlay.dragHint') }}</p>

      <ZtudioField
        :label="$t('textOverlay.size')"
        :value="(sel.fontSizePct * 100).toFixed(1) + '%'"
      >
        <Slider
          :model-value="[sel.fontSizePct]"
          :min="0.03"
          :max="0.18"
          :step="0.0025"
          @update:model-value="patch('fontSizePct', $event[0])"
        />
      </ZtudioField>

      <ZtudioField :label="$t('textOverlay.rotation')" :value="Math.round(sel.rotation || 0) + '°'">
        <Slider
          :model-value="[sel.rotation || 0]"
          :min="-180"
          :max="180"
          :step="1"
          @update:model-value="store.setTextRotation(sel.id, $event[0])"
        />
      </ZtudioField>

      <div class="grid grid-cols-2 gap-3">
        <ZtudioField :label="$t('textOverlay.colour')">
          <input
            :value="sel.color"
            type="color"
            class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
            @input="patch('color', $event.target.value)"
          />
        </ZtudioField>
        <ZtudioField :label="$t('textOverlay.outline')">
          <input
            :value="sel.strokeColor"
            type="color"
            class="h-9 w-full cursor-pointer rounded-md border border-border bg-background p-1"
            @input="patch('strokeColor', $event.target.value)"
          />
        </ZtudioField>
      </div>

      <ZtudioField
        :label="$t('textOverlay.outlineWidth')"
        :value="Math.round(sel.strokePct * 100) + '%'"
      >
        <Slider
          :model-value="[sel.strokePct]"
          :min="0"
          :max="0.2"
          :step="0.01"
          @update:model-value="patch('strokePct', $event[0])"
        />
      </ZtudioField>

      <ZtudioField :label="$t('textOverlay.bold')">
        <label class="flex items-center gap-2.5 text-sm py-1.5 select-none">
          <Switch :model-value="sel.bold" @update:model-value="patch('bold', $event)" />
          {{ $t('textOverlay.boldHint') }}
        </label>
      </ZtudioField>
    </template>
  </div>
</template>
