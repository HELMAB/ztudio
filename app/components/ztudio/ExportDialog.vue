<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { DownloadIcon } from '@lucide/vue'
import { FORMAT_OPTIONS, FPS_OPTIONS, QUALITY_OPTIONS } from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const localize = options =>
  computed(() => options.map(o => ({ value: o.value, label: t(o.labelKey) })))

const qualityOptions = localize(QUALITY_OPTIONS)
const formatOptions = localize(FORMAT_OPTIONS)
// fps is a number; the Select rides on strings, so proxy the conversion.
const fpsOptions = computed(() =>
  FPS_OPTIONS.map(o => ({ value: String(o.value), label: t(o.labelKey) })),
)
const fps = computed({
  get: () => String(store.exportSettings.fps),
  set: v => {
    store.exportSettings.fps = Number(v)
  },
})

function close() {
  store.exportDialog = false
}

function confirm() {
  store.render()
}

function onKey(e) {
  if (store.exportDialog && e.key === 'Escape') {
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
        v-if="store.exportDialog"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        data-testid="export-dialog"
      >
        <div class="absolute inset-0 bg-black/50" @click="close" />
        <div
          class="relative w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-xl"
        >
          <h3 class="font-mono text-[11px] uppercase text-muted-foreground">
            {{ $t('export.settingsTitle') }}
          </h3>

          <div class="space-y-3">
            <ZtudioField :label="$t('export.quality')">
              <ZtudioSelectField v-model="store.exportSettings.quality" :options="qualityOptions" />
            </ZtudioField>
            <ZtudioField :label="$t('export.format')">
              <ZtudioSelectField v-model="store.exportSettings.format" :options="formatOptions" />
            </ZtudioField>
            <ZtudioField :label="$t('export.fps')">
              <ZtudioSelectField v-model="fps" :options="fpsOptions" />
            </ZtudioField>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <Button variant="ghost" class="ml-auto" @click="close">
              {{ $t('captionDialog.cancel') }}
            </Button>
            <Button
              data-testid="export-dialog-confirm"
              :disabled="!store.canRender"
              class="bg-brand text-brand-foreground font-semibold hover:bg-brand/90"
              @click="confirm"
            >
              <DownloadIcon class="size-4" />
              {{ $t('actions.export') }}
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
