<script setup>
import { computed, ref } from 'vue'
import { LayersIcon, Settings2Icon } from '@lucide/vue'
import { RESOLUTION_OPTIONS } from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const resolutionOptions = computed(() =>
  RESOLUTION_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })),
)

// Icon rail (OpenCut-style): a narrow column of icon triggers on the left picks
// the section shown on the right. Triggers keep their text as an accessible
// name, so role-based queries ('tab' + label) still work.
const tab = ref('assets')
const SECTIONS = [
  { value: 'assets', icon: LayersIcon, labelKey: 'media.tabAssets' },
  { value: 'settings', icon: Settings2Icon, labelKey: 'media.tabSettings' },
]
const sectionTitle = computed(() => t(SECTIONS.find(s => s.value === tab.value).labelKey))
</script>

<template>
  <aside
    data-testid="media-panel"
    class="flex flex-col min-h-0 bg-card overflow-y-auto lg:overflow-y-hidden"
  >
    <!-- On desktop the section body scrolls on its own (the panel height is
         fixed), so controls never clip as more are added; on mobile the whole
         aside scrolls. -->
    <Tabs
      v-model="tab"
      orientation="vertical"
      class="max-lg:shrink-0 lg:flex-1 lg:min-h-0 flex-row gap-0 border-b border-border"
    >
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
        <h2
          class="shrink-0 flex items-center px-4 py-3 text-xs font-semibold text-muted-foreground border-b border-border"
        >
          {{ sectionTitle }}
        </h2>

        <div class="max-lg:shrink-0 lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-4">
          <TabsContent value="assets">
            <ZtudioAssetList />
          </TabsContent>

          <TabsContent value="settings" class="space-y-5">
            <ZtudioField :label="$t('media.resolution')">
              <ZtudioSelectField v-model="store.resolution" :options="resolutionOptions" />
            </ZtudioField>

            <div>
              <span class="block font-mono text-[11px] uppercase text-muted-foreground mb-2">
                {{ $t('media.status') }}
              </span>
              <ZtudioReadinessPills />
            </div>
          </TabsContent>
        </div>
      </div>
    </Tabs>
    <ZtudioActivityLog class="h-64 shrink-0 lg:h-80" />
  </aside>
</template>
