<script setup>
const store = useGreenroom()

const DOT_CLASS = {
  pending: 'bg-muted-foreground',
  good: 'bg-[#00b140]',
  warn: 'bg-amber-700',
  bad: 'bg-red-700',
}
</script>

<template>
  <section class="border-t border-border py-4 flex items-start gap-3">
    <span class="mt-1.5 inline-block w-[9px] h-[9px] shrink-0" :class="DOT_CLASS[store.env.level]" />
    <div>
      <div class="font-mono text-xs text-foreground">{{ store.env.title }}</div>
      <p v-if="store.env.note" class="text-sm text-muted-foreground mt-1">{{ store.env.note }}</p>
    </div>
  </section>
</template>
