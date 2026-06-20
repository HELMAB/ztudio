<script setup>
import { onMounted } from 'vue'

const store = provideGreenroom()

onMounted(() => {
  store.init()
})
</script>

<template>
  <div class="bg-background text-foreground font-sans antialiased min-h-screen">
    <div class="h-0.5 bg-[#00b140]" />
    <GreenroomHeader />
    <main class="mx-auto max-w-4xl px-6">
      <GreenroomHero />
      <GreenroomEnvReadout />
      <GreenroomSource />
      <GreenroomCaption />
      <GreenroomExport />
      <GreenroomActivity />
    </main>
    <GreenroomFooter />
  </div>
</template>
