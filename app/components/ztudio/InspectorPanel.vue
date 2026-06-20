<script setup>
import { TypeIcon } from '@lucide/vue'
</script>

<template>
  <aside class="flex flex-col min-h-0 bg-background">
    <h2
      class="shrink-0 flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase text-muted-foreground border-b border-border"
    >
      <TypeIcon class="size-3.5 text-brand" />
      {{ $t('caption.heading') }}
    </h2>
    <Tabs default-value="text" class="flex-1 min-h-0 gap-0">
      <TabsList class="m-4 mb-0 grid w-auto grid-cols-3">
        <TabsTrigger value="text">{{ $t('caption.tabText') }}</TabsTrigger>
        <TabsTrigger value="style">{{ $t('caption.tabStyle') }}</TabsTrigger>
        <TabsTrigger value="animation">{{ $t('caption.tabAnimation') }}</TabsTrigger>
      </TabsList>
      <TabsContent value="text" class="min-h-0 overflow-y-auto p-4">
        <ZtudioCaptionTextEditor />
      </TabsContent>
      <TabsContent value="style" class="min-h-0 overflow-y-auto p-4">
        <ZtudioCaptionControls />
      </TabsContent>
      <TabsContent value="animation" class="min-h-0 overflow-y-auto p-4">
        <ZtudioCaptionAnimation />
      </TabsContent>
    </Tabs>
  </aside>
</template>
