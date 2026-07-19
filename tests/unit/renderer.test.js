import { describe, expect, it } from 'vitest'
import { captionBox, captionCenter, logoRect, titleBox } from '@/lib/ztudio/renderer'

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

// captionBox needs a 2D context only for measureText; a stub with a fixed
// per-character width keeps the geometry deterministic.
const stubCtx = () => ({
  font: '',
  save() {},
  restore() {},
  measureText: s => ({ width: s.length * 10 }),
})

describe('captionBox', () => {
  const boxStyle = { ...baseStyle, fontWeight: 700, fontFamily: 'sans-serif', box: false }

  it('returns null for empty text', () => {
    expect(captionBox(stubCtx(), W, H, '', boxStyle)).toBeNull()
  })

  it('shares its centre with captionCenter', () => {
    const style = { ...boxStyle, offsetXPct: 0.1, offsetYPct: -0.05 }
    const b = captionBox(stubCtx(), W, H, 'hello\nthere', style)
    const c = captionCenter(W, H, 'hello\nthere', style)
    expect(b.cx).toBeCloseTo(c.cx, 6)
    expect(b.cy).toBeCloseTo(c.cy, 6)
  })

  it('width follows the longest measured line', () => {
    const short = captionBox(stubCtx(), W, H, 'hi', boxStyle)
    const long = captionBox(stubCtx(), W, H, 'hi\na much longer line', boxStyle)
    expect(long.bw).toBeGreaterThan(short.bw)
    // Padding aside, the width tracks the 10px-per-char stub measure.
    expect(long.bw - short.bw).toBeCloseTo(('a much longer line'.length - 2) * 10, 6)
  })

  it('grows the padding when the backdrop box is on, matching drawCaption', () => {
    const plain = captionBox(stubCtx(), W, H, 'hi', boxStyle)
    const boxed = captionBox(stubCtx(), W, H, 'hi', { ...boxStyle, box: true })
    expect(boxed.bw).toBeGreaterThan(plain.bw)
    expect(boxed.bh).toBeGreaterThan(plain.bh)
  })

  it('reports the style rotation for the gizmo', () => {
    const b = captionBox(stubCtx(), W, H, 'hi', { ...boxStyle, captionRotation: 30 })
    expect(b.rotation).toBe(30)
    expect(captionBox(stubCtx(), W, H, 'hi', boxStyle).rotation).toBe(0)
  })
})

describe('titleBox', () => {
  const item = { text: 'hello', x: 0.5, y: 0.16, fontSizePct: 0.06, bold: true }

  it('returns null for empty or whitespace text', () => {
    expect(titleBox(stubCtx(), W, H, { ...item, text: '' })).toBeNull()
    expect(titleBox(stubCtx(), W, H, { ...item, text: '   ' })).toBeNull()
  })

  it('centres on the title anchor point', () => {
    const b = titleBox(stubCtx(), W, H, { ...item, x: 0.25, y: 0.75 })
    expect(b.cx).toBeCloseTo(W * 0.25, 6)
    expect(b.cy).toBeCloseTo(H * 0.75, 6)
  })

  it('width follows the longest measured line, height the line count', () => {
    const one = titleBox(stubCtx(), W, H, item)
    const two = titleBox(stubCtx(), W, H, { ...item, text: 'hello\na much longer line' })
    expect(two.bw).toBeGreaterThan(one.bw)
    expect(two.bh).toBeGreaterThan(one.bh)
  })

  it('reports the item rotation for the gizmo', () => {
    expect(titleBox(stubCtx(), W, H, { ...item, rotation: -45 }).rotation).toBe(-45)
    expect(titleBox(stubCtx(), W, H, item).rotation).toBe(0)
  })
})

// logoRect is pure geometry (the bitmap only contributes its aspect ratio).
describe('logoRect', () => {
  const base = { bitmap: { width: 200, height: 100 }, scalePct: 0.1, marginPct: 0.04 }
  const M = Math.min(W, H) * 0.04

  it('sizes by frame width and pins to the top-right by default', () => {
    const r = logoRect(W, H, base)
    expect(r.lw).toBeCloseTo(W * 0.1, 6)
    expect(r.lh).toBeCloseTo((W * 0.1) / 2, 6)
    expect(r.x).toBeCloseTo(W - r.lw - M, 6)
    expect(r.y).toBeCloseTo(M, 6)
    expect(r.cx).toBeCloseTo(r.x + r.lw / 2, 6)
    expect(r.cy).toBeCloseTo(r.y + r.lh / 2, 6)
  })

  it('pins to the bottom-left corner', () => {
    const r = logoRect(W, H, { ...base, position: 'bottomLeft' })
    expect(r.x).toBeCloseTo(M, 6)
    expect(r.y).toBeCloseTo(H - r.lh - M, 6)
  })

  it('reports the rotation for the gizmo', () => {
    expect(logoRect(W, H, { ...base, rotation: 33 }).rotation).toBe(33)
    expect(logoRect(W, H, base).rotation).toBe(0)
  })
})
