// Stop the browser's own pinch-zoom on touch devices, so pinching drives the
// editor (dragging captions, resizing via the gizmo, scrubbing the timeline)
// instead of zooming the whole page. iOS Safari ignores the `user-scalable=no`
// viewport hint for accessibility reasons, so pinch has to be cancelled in JS
// there; the viewport meta covers Android/Chrome. Double-tap zoom is handled
// separately by `touch-action: manipulation` on the app root (see App.vue), which
// still lets the canvas's own double-tap-to-reset fire.
export default defineNuxtPlugin(() => {
  const stop = e => e.preventDefault()

  // iOS pinch fires gesture* events; cancelling gesturestart is enough to keep
  // the page from scaling.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, stop, { passive: false })
  }

  // Belt-and-suspenders for browsers without gesture events: any two-finger move
  // is a pinch on a touchscreen. One-finger panning (page/panel scroll) is left
  // alone so scrollable panels still work.
  document.addEventListener(
    'touchmove',
    e => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    },
    { passive: false },
  )
})
