<script setup>
import { SlidersHorizontalIcon } from '@lucide/vue'

// Selection drives the active tab (store.inspectorTab): clicking a clip opens
// that object's properties. Two-way bound so manual tab clicks still work.
const store = useZtudioStore()
</script>

<template>
  <aside class="flex flex-col min-h-0 bg-background">
    <!-- Redundant on mobile: the bottom tab bar already labels this section. -->
    <h2
      class="hidden lg:flex shrink-0 items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase text-muted-foreground border-b border-border"
    >
      <SlidersHorizontalIcon class="size-3.5 text-brand" />
      {{ $t('settings.heading') }}
    </h2>
    <Tabs v-model="store.inspectorTab" class="flex-1 min-h-0 gap-0">
      <TabsList class="m-4 mb-0 grid w-auto grid-cols-4">
        <TabsTrigger value="cues">{{ $t('caption.tabCues') }}</TabsTrigger>
        <TabsTrigger value="style">{{ $t('caption.tabStyle') }}</TabsTrigger>
        <TabsTrigger value="animation">{{ $t('caption.tabAnimation') }}</TabsTrigger>
        <TabsTrigger value="image">{{ $t('caption.tabImage') }}</TabsTrigger>
      </TabsList>
      <TabsContent value="cues" class="flex min-h-0 flex-col p-4">
        <ZtudioCueList />
      </TabsContent>
      <TabsContent value="style" class="min-h-0 overflow-y-auto p-4">
        <ZtudioCaptionControls />
      </TabsContent>
      <TabsContent value="animation" class="min-h-0 overflow-y-auto p-4">
        <ZtudioCaptionAnimation />
      </TabsContent>
      <TabsContent value="image" class="min-h-0 overflow-y-auto p-4">
        <ZtudioImageControls />
      </TabsContent>
    </Tabs>
  </aside>
</template>
