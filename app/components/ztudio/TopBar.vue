<script setup>
import { CircleStopIcon, DownloadIcon, LanguagesIcon } from '@lucide/vue'

const store = useZtudioStore()
const { locale, setLocale } = useI18n()

function toggleLocale() {
  setLocale(locale.value === 'en' ? 'km' : 'en')
}

const DOT_CLASS = {
  pending: 'bg-muted-foreground',
  good: 'bg-[#00b140]',
  warn: 'bg-amber-600',
  bad: 'bg-red-600',
}
</script>

<template>
  <header class="shrink-0 h-14 flex items-center justify-between gap-4 px-4 border-b border-border">
    <div class="flex items-center gap-2.5 shrink-0">
      <span class="inline-block w-2.5 h-2.5 bg-[#00b140]" />
      <span class="text-sm font-semibold">{{ $t('app.name') }}</span>
      <span class="font-mono text-[10px] uppercase text-muted-foreground hidden lg:inline">
        {{ $t('app.tagline') }}
      </span>
    </div>

    <div class="flex items-center gap-2 min-w-0 flex-1 justify-center">
      <span class="inline-block w-2 h-2 shrink-0" :class="DOT_CLASS[store.env.level]" />
      <span class="font-mono text-[11px] text-muted-foreground truncate">{{
        store.env.title
      }}</span>
    </div>

    <div class="flex items-center gap-3 shrink-0">
      <span class="font-mono text-[11px] text-muted-foreground hidden xl:inline">{{
        store.status
      }}</span>
      <Progress
        v-if="store.showProgress"
        :model-value="store.progressPercent"
        class="w-24 hidden md:block"
      />
      <Button
        variant="ghost"
        size="sm"
        class="font-mono text-[11px] uppercase"
        :aria-label="locale === 'en' ? 'ភាសាខ្មែរ' : 'English'"
        @click="toggleLocale"
      >
        <LanguagesIcon class="size-4" />
        {{ locale === 'en' ? 'ខ្មែរ' : 'EN' }}
      </Button>
      <Button
        v-if="!store.busy"
        :disabled="!store.canRender"
        class="bg-[#00b140] text-white hover:bg-[#00a038]"
        @click="store.render()"
      >
        <DownloadIcon class="size-4" />
        {{ $t('actions.export') }}
      </Button>
      <Button v-else variant="outline" class="text-red-700" @click="store.cancel()">
        <CircleStopIcon class="size-4" />
        {{ $t('actions.stop') }}
      </Button>
    </div>
  </header>
</template>
