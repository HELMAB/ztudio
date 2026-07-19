<script setup>
import { computed } from 'vue'
import { ImageIcon } from '@lucide/vue'
import { LOGO_POSITION_OPTIONS } from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const logoPositionOptions = computed(() =>
  LOGO_POSITION_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })),
)
const pct = v => Math.round(v * 100) + '%'
</script>

<template>
  <div data-testid="logo-controls" class="space-y-4">
    <!-- Persistent watermark / logo, pinned to a corner of every frame. -->
    <ZtudioMediaUploader
      accept="image/*"
      :title="$t('logo.upload')"
      :hint="$t('logo.hint')"
      :icon="ImageIcon"
      :ok="store.logoPill.ok"
      :status="store.logoPill.text"
      @select="store.loadLogo($event)"
      @clear="store.loadLogo(null)"
    />

    <template v-if="store.hasLogo">
      <ZtudioField :label="$t('logo.position')">
        <ZtudioSelectField v-model="store.logo.position" :options="logoPositionOptions" />
      </ZtudioField>

      <div class="grid grid-cols-2 gap-3">
        <ZtudioField :label="$t('logo.size')" :value="pct(store.logo.scalePct)">
          <Slider
            :model-value="[store.logo.scalePct]"
            :min="0.05"
            :max="0.5"
            :step="0.01"
            @update:model-value="store.logo.scalePct = $event[0]"
          />
        </ZtudioField>
        <ZtudioField :label="$t('logo.opacity')" :value="pct(store.logo.opacity)">
          <Slider
            :model-value="[store.logo.opacity]"
            :min="0.1"
            :max="1"
            :step="0.05"
            @update:model-value="store.logo.opacity = $event[0]"
          />
        </ZtudioField>
      </div>

      <ZtudioField :label="$t('logo.rotation')" :value="Math.round(store.logo.rotation || 0) + '°'">
        <Slider
          :model-value="[store.logo.rotation || 0]"
          :min="-180"
          :max="180"
          :step="1"
          @update:model-value="store.logo.rotation = $event[0]"
        />
      </ZtudioField>
    </template>
  </div>
</template>
