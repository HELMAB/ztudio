<script setup>
import { CircleStopIcon, DownloadIcon, LanguagesIcon, Redo2Icon, Undo2Icon } from '@lucide/vue'

const store = useZtudioStore()
const { locale, setLocale } = useI18n()

function toggleLocale() {
  setLocale(locale.value === 'en' ? 'km' : 'en')
}

const DOT_CLASS = {
  pending: 'bg-muted-foreground',
  good: 'bg-brand',
  warn: 'bg-amber-600',
  bad: 'bg-red-600',
}
</script>

<template>
  <header
    class="shrink-0 h-14 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 border-b border-border bg-card/40"
  >
    <div class="flex items-center gap-2.5 shrink-0">
      <span
        class="grid place-items-center size-6 rounded-md bg-brand text-brand-foreground font-bold text-xs shadow-sm shadow-brand/30"
        >z</span
      >
      <span class="text-sm font-semibold">{{ $t('app.name') }}</span>
      <span class="font-mono text-[10px] uppercase text-muted-foreground hidden lg:inline">
        {{ $t('app.tagline') }}
      </span>
    </div>

    <div
      class="hidden sm:flex items-center gap-2 min-w-0 flex-1 justify-center px-2.5 py-1 rounded-full border border-border bg-background/60 max-w-fit mx-auto"
    >
      <span
        class="inline-block size-1.5 rounded-full shrink-0"
        :class="DOT_CLASS[store.env.level]"
      />
      <span class="font-mono text-[11px] text-muted-foreground truncate">{{
        store.env.title
      }}</span>
    </div>

    <div class="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-auto sm:ml-0">
      <span class="font-mono text-[11px] text-muted-foreground hidden xl:inline">{{
        store.status
      }}</span>
      <Progress
        v-if="store.showProgress"
        :model-value="store.progressPercent"
        class="w-24 hidden md:block"
      />
      <Button
        size="icon"
        variant="ghost"
        :disabled="!store.canUndo"
        :aria-label="$t('actions.undo')"
        :title="$t('actions.undo')"
        @click="store.undo()"
      >
        <Undo2Icon class="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        :disabled="!store.canRedo"
        :aria-label="$t('actions.redo')"
        :title="$t('actions.redo')"
        @click="store.redo()"
      >
        <Redo2Icon class="size-4" />
      </Button>
      <Button
        variant="ghost"
        class="font-mono text-[11px] uppercase px-2.5 sm:px-3"
        :aria-label="locale === 'en' ? 'ភាសាខ្មែរ' : 'English'"
        @click="toggleLocale"
      >
        <LanguagesIcon class="size-4" />
        {{ locale === 'en' ? 'ខ្មែរ' : 'EN' }}
      </Button>
      <Button
        v-if="!store.busy"
        :disabled="!store.canRender"
        class="bg-brand text-brand-foreground font-semibold hover:bg-brand/90 shadow-sm shadow-brand/20"
        @click="store.render()"
      >
        <DownloadIcon class="size-4" />
        {{ $t('actions.export') }}
      </Button>
      <Button
        v-else
        variant="outline"
        class="text-red-500 border-red-500/40"
        @click="store.cancel()"
      >
        <CircleStopIcon class="size-4" />
        {{ $t('actions.stop') }}
      </Button>
    </div>
  </header>
</template>
