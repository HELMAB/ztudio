<script setup>
import { useDark } from '@vueuse/core'
import {
  CircleStopIcon,
  DownloadIcon,
  KeyboardIcon,
  LanguagesIcon,
  MoonIcon,
  PanelLeftIcon,
  PanelRightIcon,
  Redo2Icon,
  SunIcon,
  Undo2Icon,
} from '@lucide/vue'

const store = useZtudioStore()
const { locale, setLocale } = useI18n()

// Light/dark theme: follows the system preference until the user picks one,
// then persists the choice (adds/removes `dark` on <html>).
const isDark = useDark({ storageKey: 'ztudio_theme' })

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
  <header class="shrink-0 h-13 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4">
    <div class="flex items-center gap-2.5 shrink-0">
      <span
        class="grid place-items-center size-7 rounded-lg bg-foreground text-background font-bold text-sm"
        >z</span
      >
      <span class="text-sm font-semibold">{{ $t('app.name') }}</span>
      <span class="text-[11px] text-muted-foreground hidden lg:inline">
        {{ $t('app.tagline') }}
      </span>
    </div>

    <div
      class="hidden sm:flex items-center gap-2 min-w-0 flex-1 justify-center px-3 py-1 rounded-full border border-border bg-card max-w-fit mx-auto"
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
      <span
        v-if="store.autosaveStatus !== 'idle'"
        class="hidden font-mono text-[10px] lg:inline"
        :class="store.autosaveStatus === 'error' ? 'text-amber-600' : 'text-muted-foreground'"
      >
        {{
          store.autosaveStatus === 'saving'
            ? $t('autosave.saving')
            : store.autosaveStatus === 'error'
              ? $t('autosave.error')
              : $t('autosave.saved')
        }}
      </span>
      <Progress
        v-if="store.showProgress"
        :model-value="store.progressPercent"
        class="w-24 hidden md:block"
      />
      <Button
        size="icon"
        :variant="store.layout.mediaOpen ? 'secondary' : 'ghost'"
        class="hidden lg:inline-flex"
        :aria-label="$t('layout.toggleMedia')"
        :aria-pressed="store.layout.mediaOpen"
        :title="$t('layout.toggleMedia')"
        data-testid="toggle-media"
        @click="store.toggleMediaPanel()"
      >
        <PanelLeftIcon class="size-4" />
      </Button>
      <Button
        size="icon"
        :variant="store.layout.inspectorOpen ? 'secondary' : 'ghost'"
        class="hidden lg:inline-flex"
        :aria-label="$t('layout.toggleInspector')"
        :aria-pressed="store.layout.inspectorOpen"
        :title="$t('layout.toggleInspector')"
        data-testid="toggle-inspector"
        @click="store.toggleInspectorPanel()"
      >
        <PanelRightIcon class="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        class="hidden sm:inline-flex"
        :aria-label="$t('shortcuts.title')"
        :title="$t('shortcuts.title')"
        @click="store.showShortcuts = true"
      >
        <KeyboardIcon class="size-4" />
      </Button>
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
        data-testid="locale-toggle"
        class="font-mono text-[11px] uppercase px-2.5 sm:px-3"
        :aria-label="locale === 'en' ? 'ភាសាខ្មែរ' : 'English'"
        @click="toggleLocale"
      >
        <LanguagesIcon class="size-4" />
        {{ locale === 'en' ? 'ខ្មែរ' : 'EN' }}
      </Button>
      <Button
        v-if="!store.busy"
        data-testid="export-button"
        :disabled="!store.canRender"
        class="rounded-lg bg-brand text-brand-foreground font-semibold hover:bg-brand/90 shadow-sm ring-2 ring-brand/25 ring-offset-1 ring-offset-background"
        @click="store.openExportDialog()"
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
      <Button
        size="icon"
        variant="ghost"
        data-testid="theme-toggle"
        :aria-label="isDark ? $t('theme.light') : $t('theme.dark')"
        :title="isDark ? $t('theme.light') : $t('theme.dark')"
        @click="isDark = !isDark"
      >
        <SunIcon v-if="isDark" class="size-4" />
        <MoonIcon v-else class="size-4" />
      </Button>
    </div>
  </header>
</template>
