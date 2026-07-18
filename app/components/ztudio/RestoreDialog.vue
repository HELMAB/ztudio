<script setup>
const store = useZtudioStore()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.pendingRestore"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
    >
      <div class="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
        <h3 class="text-base font-semibold text-foreground">{{ $t('restore.title') }}</h3>
        <p class="mt-1.5 text-sm text-muted-foreground">{{ $t('restore.body') }}</p>
        <div class="mt-4 flex gap-2">
          <Button
            class="flex-1 bg-brand text-brand-foreground hover:bg-brand/90"
            @click="store.restoreProject()"
          >
            {{ $t('restore.resume') }}
          </Button>
          <Button variant="outline" class="flex-1" @click="store.discardRestore()">
            {{ $t('restore.fresh') }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
