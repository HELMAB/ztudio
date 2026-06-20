<script setup>
import { XIcon } from '@lucide/vue'

const store = useGreenroomStore()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.result"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      @click.self="store.dismissResult()"
    >
      <div class="w-full max-w-lg rounded-lg border border-border bg-background p-5 shadow-xl">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-mono text-[11px] uppercase text-muted-foreground">Export complete</h3>
          <Button size="icon" variant="ghost" class="size-7" @click="store.dismissResult()">
            <XIcon class="size-4" />
          </Button>
        </div>
        <GreenroomResult />
      </div>
    </div>
  </Teleport>
</template>
