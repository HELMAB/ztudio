<script setup>
import { ClapperboardIcon, CircleStopIcon, FilmIcon, RefreshCwIcon } from '@lucide/vue'

const store = useGreenroomStore()
</script>

<template>
  <section class="border-t border-border py-10">
    <GreenroomSectionHeading :icon="ClapperboardIcon">Export</GreenroomSectionHeading>
    <div class="flex flex-wrap gap-3 items-center">
      <Button
        v-if="!store.busy"
        :disabled="!store.canRender"
        class="bg-[#00b140] text-white hover:bg-[#00a038] px-6 py-3"
        @click="store.render()"
      >
        <FilmIcon class="size-4" />
        Render video
      </Button>
      <Button v-else variant="outline" class="text-red-700 px-6 py-3" @click="store.cancel()">
        <CircleStopIcon class="size-4" />
        Stop
      </Button>
      <Button
        variant="outline"
        :disabled="store.busy"
        class="text-muted-foreground px-5 py-3"
        @click="store.redraw()"
      >
        <RefreshCwIcon class="size-4" />
        Refresh preview
      </Button>
    </div>

    <p class="text-sm text-muted-foreground mt-4 min-h-[1.3em]">{{ store.status }}</p>
    <Progress v-if="store.showProgress" :model-value="store.progressPercent" class="mt-3" />
    <GreenroomResult v-if="store.result" class="mt-5" />
  </section>
</template>
