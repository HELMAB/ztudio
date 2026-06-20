<script setup>
const store = useGreenroomStore()
</script>

<template>
  <section class="border-t border-border py-10">
    <GreenroomSectionHeading>Export</GreenroomSectionHeading>
    <div class="flex flex-wrap gap-3 items-center">
      <Button
        v-if="!store.busy"
        :disabled="!store.canRender"
        class="bg-[#00b140] text-white hover:bg-[#00a038] px-6 py-3"
        @click="store.render()"
      >
        Render video
      </Button>
      <Button v-else variant="outline" class="text-red-700 px-6 py-3" @click="store.cancel()">
        Stop
      </Button>
      <Button
        variant="outline"
        :disabled="store.busy"
        class="text-muted-foreground px-5 py-3"
        @click="store.redraw()"
      >
        Refresh preview
      </Button>
    </div>

    <p class="text-sm text-muted-foreground mt-4 min-h-[1.3em]">{{ store.status }}</p>
    <Progress v-if="store.showProgress" :model-value="store.progressPercent" class="mt-3" />
    <GreenroomResult v-if="store.result" class="mt-5" />
  </section>
</template>
