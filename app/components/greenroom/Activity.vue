<script setup>
import { nextTick, ref, watch } from 'vue'

const store = useGreenroom()
const logBox = ref(null)

watch(() => store.logEntries.length, async () => {
  await nextTick()
  if (logBox.value) {
    logBox.value.scrollTop = logBox.value.scrollHeight
  }
})
</script>

<template>
  <section class="border-t border-border py-10">
    <GreenroomSectionHeading>Activity</GreenroomSectionHeading>
    <div
      ref="logBox"
      class="font-mono text-xs leading-relaxed bg-muted/40 text-muted-foreground p-3.5 max-h-[220px] overflow-auto whitespace-pre-wrap border border-border rounded-md"
    >
      <div v-for="(line, i) in store.logEntries" :key="i">{{ line }}</div>
    </div>
  </section>
</template>
