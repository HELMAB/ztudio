import { describe, expect, it } from 'vitest'
import {
  EASINGS,
  applyKeyframes,
  imageFramingAt,
  keyframeValues,
} from '@/lib/ztudio/keyframes'

const kf = (t, values, easing = 'linear') => ({ t, easing, values })

describe('EASINGS', () => {
  it('all easing curves pin the endpoints at 0 and 1', () => {
    for (const ease of Object.values(EASINGS)) {
      expect(ease(0)).toBeCloseTo(0, 6)
      expect(ease(1)).toBeCloseTo(1, 6)
    }
  })

  it('easeInOut is symmetric around the midpoint', () => {
    expect(EASINGS.easeInOut(0.5)).toBeCloseTo(0.5, 6)
  })
})

describe('keyframeValues', () => {
  const fields = ['offsetXPct']

  it('returns null when there are no keyframes', () => {
    expect(keyframeValues([], 1, fields)).toBeNull()
    expect(keyframeValues(null, 1, fields)).toBeNull()
  })

  it('holds the first keyframe value before the first key', () => {
    const keys = [kf(1, { offsetXPct: 10 }), kf(2, { offsetXPct: 20 })]
    expect(keyframeValues(keys, 0, fields)).toEqual({ offsetXPct: 10 })
  })

  it('holds the last keyframe value after the last key', () => {
    const keys = [kf(1, { offsetXPct: 10 }), kf(2, { offsetXPct: 20 })]
    expect(keyframeValues(keys, 5, fields)).toEqual({ offsetXPct: 20 })
  })

  it('linearly interpolates between two keys', () => {
    const keys = [kf(0, { offsetXPct: 0 }), kf(2, { offsetXPct: 100 }, 'linear')]
    expect(keyframeValues(keys, 1, fields)).toEqual({ offsetXPct: 50 })
  })

  it('applies the destination keyframe easing', () => {
    const keys = [kf(0, { offsetXPct: 0 }), kf(1, { offsetXPct: 100 }, 'easeIn')]
    // easeIn(0.5) = 0.25 -> 25
    expect(keyframeValues(keys, 0.5, fields).offsetXPct).toBeCloseTo(25, 6)
  })

  it('sorts unordered keyframes before interpolating', () => {
    const keys = [kf(2, { offsetXPct: 100 }, 'linear'), kf(0, { offsetXPct: 0 })]
    expect(keyframeValues(keys, 1, fields)).toEqual({ offsetXPct: 50 })
  })

  it('only returns the requested fields', () => {
    const keys = [kf(0, { offsetXPct: 1, offsetYPct: 2 })]
    expect(keyframeValues(keys, 0, ['offsetXPct'])).toEqual({ offsetXPct: 1 })
  })
})

describe('applyKeyframes', () => {
  it('returns the base style untouched when there are no keyframes', () => {
    const style = { offsetXPct: 5 }
    expect(applyKeyframes(style, [], 0)).toBe(style)
  })

  it('merges interpolated caption offsets onto the style', () => {
    const style = { fill: '#fff', offsetXPct: 0, offsetYPct: 0 }
    const keys = [
      kf(0, { offsetXPct: 0, offsetYPct: 0 }),
      kf(2, { offsetXPct: 40, offsetYPct: 20 }, 'linear'),
    ]
    const out = applyKeyframes(style, keys, 1)
    expect(out).toMatchObject({ fill: '#fff', offsetXPct: 20, offsetYPct: 10 })
  })
})

describe('imageFramingAt', () => {
  const img = { start: 0, end: 4, zoom: 1.5, offsetXPct: 0, offsetYPct: 0 }

  it('returns static framing when no keyframes fall in the clip span', () => {
    const out = imageFramingAt(img, [kf(10, { imageZoom: 3 })], 1)
    expect(out).toEqual({ zoom: 1.5, offsetXPct: 0, offsetYPct: 0 })
  })

  it('defaults missing framing fields sensibly', () => {
    const out = imageFramingAt({ start: 0, end: 1 }, [], 0)
    expect(out).toEqual({ zoom: 1, offsetXPct: 0, offsetYPct: 0 })
  })

  it('interpolates between keyframes inside the clip range', () => {
    // Both keys are strictly inside the clip's half-open [start, end) span.
    const keys = [
      kf(0, { imageZoom: 1, imageOffsetXPct: 0, imageOffsetYPct: 0 }),
      kf(2, { imageZoom: 2, imageOffsetXPct: 10, imageOffsetYPct: 0 }, 'linear'),
    ]
    const out = imageFramingAt(img, keys, 1)
    expect(out.zoom).toBeCloseTo(1.5, 6)
    expect(out.offsetXPct).toBeCloseTo(5, 6)
  })

  it("excludes a keyframe sitting exactly on the clip's end (range is half-open)", () => {
    // The key at t=4 == img.end is out of scope, so framing stays static.
    const keys = [kf(4, { imageZoom: 3, imageOffsetXPct: 9, imageOffsetYPct: 0 })]
    expect(imageFramingAt(img, keys, 4)).toEqual({ zoom: 1.5, offsetXPct: 0, offsetYPct: 0 })
  })
})
