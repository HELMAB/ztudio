<script setup>
import { XIcon } from '@lucide/vue'

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
        class="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg border border-border bg-background p-4 sm:p-5 shadow-xl"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-mono text-[11px] uppercase text-muted-foreground">
            {{ $t('result.complete') }}
          </h3>
          <Button size="icon" variant="ghost" class="size-7" @click="store.dismissResult()">
            <XIcon class="size-4" />
          </Button>
        </div>
        <ZtudioResult />
      </div>
    </div>
  </Teleport>
</template>
