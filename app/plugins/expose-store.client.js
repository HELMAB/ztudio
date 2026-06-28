// Dev-only: expose the Pinia store on window so E2E tests can assert real app
// state (slider/select/switch effects) without pixel-peeping the canvas. Stripped
// from production builds via the import.meta.dev guard, and only ever attached on
// the client. Pinia stores are singletons per app, so this is the same instance
// the components use.
export default defineNuxtPlugin(() => {
  if (import.meta.dev && typeof window !== 'undefined') {
    window.__ztudio = useZtudioStore()
  }
})
