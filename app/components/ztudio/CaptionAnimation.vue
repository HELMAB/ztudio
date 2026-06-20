<script setup>
import { computed } from 'vue'
import { ANIMATION_OPTIONS } from '@/lib/ztudio/config'

const store = useZtudioStore()
const { t } = useI18n()

const animationOptions = computed(() =>
  ANIMATION_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) })),
)
</script>

<template>
  <div class="space-y-4">
    <ZtudioField :label="$t('controls.animation')">
      <ZtudioSelectField v-model="store.controls.animation" :options="animationOptions" />
    </ZtudioField>
  </div>
</template>
