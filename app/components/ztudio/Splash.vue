<script setup>
// Branded startup splash. App.vue mounts this over everything until
// store.init() resolves, then fades it out.
</script>

<template>
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-background text-foreground"
    role="status"
    aria-live="polite"
    data-testid="splash"
  >
    <div class="flex flex-col items-center gap-5">
      <span
        class="grid place-items-center size-16 rounded-2xl bg-brand text-brand-foreground font-bold text-3xl shadow-lg shadow-brand/30 animate-pulse"
        >z</span
      >

      <div class="flex flex-col items-center gap-1.5">
        <span class="text-xl font-semibold">{{ $t('app.name') }}</span>
        <span class="font-mono text-[10px] uppercase text-muted-foreground">
          {{ $t('app.tagline') }}
        </span>
      </div>

      <div class="mt-2 h-0.5 w-40 overflow-hidden rounded-full bg-muted">
        <span
          class="block h-full w-1/3 rounded-full bg-brand animate-[splash-slide_1.1s_ease-in-out_infinite]"
        />
      </div>

      <span class="font-mono text-[11px] text-muted-foreground">{{ $t('app.loading') }}</span>
    </div>
  </div>
</template>

<style>
@keyframes splash-slide {
  0% {
    transform: translateX(-130%);
  }
  100% {
    transform: translateX(420%);
  }
}
</style>
