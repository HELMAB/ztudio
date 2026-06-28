import { describe, expect, it } from 'vitest'
import { drawOverlay } from '@/lib/ztudio/overlays'

// A recording 2D-context stand-in: every drawing method is a counter so tests can
// assert behaviour (no-op vs draw, particle count scaling) without a real canvas.
function mockCtx() {
  const calls = {}
  const ctx = {}
  const methods = [
    'save',
    'restore',
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'arc',
    'arcTo',
    'ellipse',
    'rect',
    'roundRect',
    'fill',
    'stroke',
    'fillRect',
    'translate',
    'rotate',
    'scale',
    'setTransform',
    'quadraticCurveTo',
    'bezierCurveTo',
  ]
  for (const m of methods) {
    calls[m] = 0
    ctx[m] = () => {
      calls[m]++
    }
  }
  ctx.calls = calls
  // Writable style props the overlay sets.
  ctx.fillStyle = ''
  ctx.strokeStyle = ''
  ctx.globalAlpha = 1
  ctx.lineWidth = 1
  ctx.lineCap = ''
  return ctx
}

describe('drawOverlay', () => {
  it('is a no-op when no overlay is set', () => {
    const ctx = mockCtx()
    drawOverlay(ctx, 100, 100, 0, { overlay: 'none' })
    drawOverlay(ctx, 100, 100, 0, {})
    expect(ctx.calls.save).toBe(0)
    expect(ctx.calls.beginPath).toBe(0)
  })

  it('is a no-op for an unknown overlay key', () => {
    const ctx = mockCtx()
    drawOverlay(ctx, 100, 100, 0, { overlay: 'not-real' })
    expect(ctx.calls.save).toBe(0)
  })

  it('draws (save/restore balanced) when an overlay is active', () => {
    const ctx = mockCtx()
    drawOverlay(ctx, 100, 100, 0, { overlay: 'leaves', overlayIntensity: 1 })
    expect(ctx.calls.save).toBeGreaterThanOrEqual(1)
    expect(ctx.calls.restore).toBe(ctx.calls.save)
    expect(ctx.calls.beginPath).toBeGreaterThan(0)
  })

  it('scales particle work with intensity', () => {
    const low = mockCtx()
    const high = mockCtx()
    drawOverlay(low, 200, 200, 0.5, { overlay: 'leaves', overlayIntensity: 0.5 })
    drawOverlay(high, 200, 200, 0.5, { overlay: 'leaves', overlayIntensity: 2 })
    expect(high.calls.beginPath).toBeGreaterThan(low.calls.beginPath)
  })

  it('renders a rain-style overlay (strokes lines)', () => {
    const ctx = mockCtx()
    drawOverlay(ctx, 200, 200, 0, { overlay: 'rainHeavy', overlayIntensity: 1 })
    expect(ctx.calls.stroke).toBeGreaterThan(0)
  })

  it('is deterministic for the same time and inputs', () => {
    const a = mockCtx()
    const b = mockCtx()
    drawOverlay(a, 200, 200, 1.23, { overlay: 'snowGentle', overlayIntensity: 1 })
    drawOverlay(b, 200, 200, 1.23, { overlay: 'snowGentle', overlayIntensity: 1 })
    expect(a.calls).toEqual(b.calls)
  })
})
