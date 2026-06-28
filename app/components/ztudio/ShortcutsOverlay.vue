<script setup>
import { computed } from 'vue'
import { XIcon } from '@lucide/vue'

const store = useZtudioStore()
const { t } = useI18n()

// Each row: an array of key glyphs and a translated action. Glyphs are literal so
// they read the same in any locale; only the action text is translated.
const groups = computed(() => [
  {
    title: t('shortcuts.playback'),
    rows: [
      { keys: ['Space'], action: t('shortcuts.playPause') },
      { keys: ['←', '→'], action: t('shortcuts.stepFrame') },
      { keys: ['Alt', '←', '→'], action: t('shortcuts.stepSecond') },
      { keys: ['⇧', '←', '→'], action: t('shortcuts.prevNextCaption') },
      { keys: ['Home', 'End'], action: t('shortcuts.startEnd') },
      { keys: ['L'], action: t('shortcuts.toggleLoop') },
      { keys: ['M'], action: t('shortcuts.mute') },
    ],
  },
  {
    title: t('shortcuts.editing'),
    rows: [
      { keys: ['Delete'], action: t('shortcuts.deleteSelected') },
      { keys: ['⌘', 'Z'], action: t('shortcuts.undo') },
      { keys: ['⌘', '⇧', 'Z'], action: t('shortcuts.redo') },
    ],
  },
  {
    title: t('shortcuts.view'),
    rows: [
      { keys: ['+', '−'], action: t('shortcuts.zoom') },
      { keys: ['0'], action: t('shortcuts.zoomFit') },
      { keys: ['?'], action: t('shortcuts.toggleHelp') },
    ],
  },
])
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.showShortcuts"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      @click.self="store.showShortcuts = false"
    >
      <div
        class="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border border-border bg-background p-4 sm:p-5 shadow-xl"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-mono text-[11px] uppercase text-muted-foreground">
            {{ $t('shortcuts.title') }}
          </h3>
          <Button size="icon" variant="ghost" class="size-7" @click="store.showShortcuts = false">
            <XIcon class="size-4" />
          </Button>
        </div>

        <div class="space-y-4">
          <section v-for="g in groups" :key="g.title">
            <h4 class="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-brand">
              {{ g.title }}
            </h4>
            <ul class="space-y-1">
              <li
                v-for="(row, i) in g.rows"
                :key="i"
                class="flex items-center justify-between gap-3 py-0.5"
              >
                <span class="text-sm text-foreground">{{ row.action }}</span>
                <span class="flex shrink-0 items-center gap-1">
                  <kbd
                    v-for="(k, j) in row.keys"
                    :key="j"
                    class="min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-[11px] text-muted-foreground"
                  >
                    {{ k }}
                  </kbd>
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
