import { describe, expect, it } from 'vitest'
import { captionCenter } from '@/lib/ztudio/renderer'

// captionCenter is pure geometry (no canvas), driven by the normalized style.
const baseStyle = {
  fontSizePct: 0.05,
  lineHeight: 1.2,
  topMarginPct: 0.09,
  bottomMarginPct: 0.09,
  position: 'bottom',
  offsetXPct: 0,
  offsetYPct: 0,
}

const W = 1080
const H = 1920

describe('captionCenter', () => {
  it('returns null for empty text', () => {
    expect(captionCenter(W, H, '', baseStyle)).toBeNull()
    expect(captionCenter(W, H, null, baseStyle)).toBeNull()
  })

  it('horizontally centres a single line by default', () => {
    const c = captionCenter(W, H, 'hello', baseStyle)
    expect(c.cx).toBe(W / 2)
  })

  it('places a bottom caption in the lower half', () => {
    const c = captionCenter(W, H, 'hello', baseStyle)
    expect(c.cy).toBeGreaterThan(H / 2)
  })

  it('places a top caption in the upper half', () => {
    const c = captionCenter(W, H, 'hello', { ...baseStyle, position: 'top' })
    expect(c.cy).toBeLessThan(H / 2)
  })

  it('reports a taller block for more lines', () => {
    const one = captionCenter(W, H, 'a', baseStyle)
    const three = captionCenter(W, H, 'a\nb\nc', baseStyle)
    expect(three.blockH).toBeGreaterThan(one.blockH)
    // blockH scales linearly with line count.
    expect(three.blockH).toBeCloseTo(one.blockH * 3, 6)
  })

  it('applies horizontal and vertical offsets relative to frame size', () => {
    const c = captionCenter(W, H, 'hi', { ...baseStyle, offsetXPct: 0.1, offsetYPct: -0.05 })
    expect(c.cx).toBeCloseTo(W / 2 + W * 0.1, 6)
    const base = captionCenter(W, H, 'hi', baseStyle)
    expect(c.cy).toBeCloseTo(base.cy + H * -0.05, 6)
  })

  it('centre position sits near the vertical middle', () => {
    const c = captionCenter(W, H, 'hi', { ...baseStyle, position: 'center' })
    expect(c.cy).toBeCloseTo(H / 2, 0)
  })
})
