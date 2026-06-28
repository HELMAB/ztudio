import { describe, expect, it } from 'vitest'
import { clipCrop, effectFilter, imageAt } from '@/lib/ztudio/images'
import { IMAGE_EFFECTS } from '@/lib/ztudio/config'

describe('effectFilter', () => {
  it("returns 'none' for a missing or 'none' effect", () => {
    expect(effectFilter()).toBe('none')
    expect(effectFilter('none')).toBe('none')
  })

  it('resolves a known effect to its canvas filter string', () => {
    const mono = IMAGE_EFFECTS.find(e => e.value === 'mono')
    expect(effectFilter('mono')).toBe(mono.filter)
  })

  it("falls back to 'none' for an unknown effect", () => {
    expect(effectFilter('does-not-exist')).toBe('none')
  })
})

describe('imageAt', () => {
  const images = [
    { id: 1, start: 0, end: 2 },
    { id: 2, start: 2, end: 4 },
  ]

  it('returns null when there are no images', () => {
    expect(imageAt(1, [])).toBeNull()
    expect(imageAt(1, null)).toBeNull()
  })

  it('returns the clip whose half-open range contains t', () => {
    expect(imageAt(1, images).id).toBe(1)
    expect(imageAt(2, images).id).toBe(2)
  })

  it('returns null in a gap between clips', () => {
    const gapped = [
      { id: 1, start: 0, end: 1 },
      { id: 2, start: 3, end: 4 },
    ]
    expect(imageAt(2, gapped)).toBeNull()
  })

  it('prefers the last matching clip when ranges overlap', () => {
    const overlap = [
      { id: 1, start: 0, end: 3 },
      { id: 2, start: 1, end: 4 },
    ]
    expect(imageAt(2, overlap).id).toBe(2)
  })
})

describe('clipCrop', () => {
  it('returns null for an uncropped clip', () => {
    expect(clipCrop({})).toBeNull()
    expect(clipCrop({ cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0 })).toBeNull()
  })

  it('builds a normalized rect from the crop insets', () => {
    expect(clipCrop({ cropTop: 0.1, cropBottom: 0.2, cropLeft: 0.05, cropRight: 0.15 })).toEqual({
      x: 0.05,
      y: 0.1,
      w: 1 - 0.05 - 0.15,
      h: 1 - 0.1 - 0.2,
    })
  })

  it('clamps width and height to a 0.05 minimum', () => {
    const rect = clipCrop({ cropLeft: 0.6, cropRight: 0.6 })
    expect(rect.w).toBe(0.05)
  })
})
