<script setup>
import { CheckIcon, XIcon } from '@lucide/vue'

const store = useZtudioStore()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.result"
      data-testid="result-overlay"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      @click.self="store.dismissResult()"
    >
      <div
        class="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-2xl sm:p-7"
      >
        <div class="mb-5 flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span
              class="grid size-9 shrink-0 place-items-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/30"
            >
              <CheckIcon class="size-5" />
            </span>
            <div>
              <h3 class="text-base font-semibold leading-tight">{{ $t('result.complete') }}</h3>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ $t('result.subtitle') }}</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            class="size-7 shrink-0"
            :aria-label="$t('captionDialog.cancel')"
            @click="store.dismissResult()"
          >
            <XIcon class="size-4" />
          </Button>
        </div>
        <ZtudioResult />
      </div>
    </div>
  </Teleport>
</template>
