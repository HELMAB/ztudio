<script setup>
import { computed } from 'vue'
import { ImageIcon, MessageSquareTextIcon, MusicIcon, PaletteIcon, SparklesIcon } from '@lucide/vue'

// Selection drives the active section (store.inspectorTab): clicking a clip
// opens that object's properties. Two-way bound so manual rail clicks still
// work. Icon rail (OpenCut-style): triggers keep their text as an accessible
// name, so role-based queries ('tab' + label) still work.
const store = useZtudioStore()
const { t } = useI18n()

const SECTIONS = [
  { value: 'cues', icon: MessageSquareTextIcon, labelKey: 'caption.tabCues' },
  { value: 'style', icon: PaletteIcon, labelKey: 'caption.tabStyle' },
  { value: 'animation', icon: SparklesIcon, labelKey: 'caption.tabAnimation' },
  { value: 'image', icon: ImageIcon, labelKey: 'caption.tabImage' },
  { value: 'audio', icon: MusicIcon, labelKey: 'caption.tabAudio' },
]
const sectionTitle = computed(
  () => t(SECTIONS.find(s => s.value === store.inspectorTab)?.labelKey ?? 'settings.heading'),
)
</script>

<template>
  <aside data-testid="inspector" class="flex flex-col min-h-0 bg-card">
    <Tabs v-model="store.inspectorTab" orientation="vertical" class="flex-1 min-h-0 flex-row gap-0">
      <TabsList
        class="h-auto w-11 shrink-0 flex-col justify-start gap-1 self-stretch rounded-none border-r border-border bg-transparent p-1.5"
      >
        <TabsTrigger
          v-for="s in SECTIONS"
          :key="s.value"
          :value="s.value"
          :aria-label="$t(s.labelKey)"
          :title="$t(s.labelKey)"
          class="size-8 flex-none p-0 text-muted-foreground data-[state=active]:bg-brand-muted data-[state=active]:text-brand data-[state=active]:shadow-none dark:data-[state=active]:bg-brand-muted dark:data-[state=active]:text-brand"
        >
          <component :is="s.icon" class="size-4" />
        </TabsTrigger>
      </TabsList>

      <div class="flex-1 min-w-0 flex flex-col min-h-0">
        <!-- Redundant on mobile: the bottom tab bar already labels this section. -->
        <h2
          class="hidden lg:flex shrink-0 items-center px-4 py-3 text-xs font-semibold text-muted-foreground border-b border-border"
        >
          {{ sectionTitle }}
        </h2>
        <TabsContent value="cues" class="flex min-h-0 flex-1 flex-col p-4">
          <ZtudioCueList />
        </TabsContent>
        <TabsContent value="style" class="min-h-0 flex-1 overflow-y-auto p-4">
          <ZtudioCaptionControls />
        </TabsContent>
        <TabsContent value="animation" class="min-h-0 flex-1 overflow-y-auto p-4">
          <ZtudioCaptionAnimation />
        </TabsContent>
        <TabsContent value="image" class="min-h-0 flex-1 overflow-y-auto p-4">
          <ZtudioImageControls />
        </TabsContent>
        <TabsContent value="audio" class="min-h-0 flex-1 overflow-y-auto p-4">
          <ZtudioAudioControls />
        </TabsContent>
      </div>
    </Tabs>
  </aside>
</template>
