import { describe, expect, it } from 'vitest'
import { buildSegments } from '@/lib/ztudio/segments'

// Sum of segment durations should always cover the whole window, and segments
// should be contiguous starting at `from`.
const coverage = segs => segs.reduce((acc, s) => acc + s.dur, 0)
const boundaries = segs => segs.map(s => +s.start.toFixed(3))

describe('buildSegments', () => {
  it('returns a single long frame for a static window with no cues', () => {
    // No cues, no animation: only the 1s MAX_FRAME_DUR cap creates boundaries.
    const segs = buildSegments([], 0, 0.8)
    expect(segs).toEqual([{ start: 0, dur: 0.8 }])
  })

  it('caps static stretches at MAX_FRAME_DUR (1s)', () => {
    const segs = buildSegments([], 0, 2.5)
    // Boundaries at 0,1,2 -> spans 1,1,0.5
    expect(boundaries(segs)).toEqual([0, 1, 2])
    expect(segs.map(s => +s.dur.toFixed(3))).toEqual([1, 1, 0.5])
  })

  it('places a frame boundary at each cue start and end', () => {
    const cues = [{ start: 0.3, end: 0.6, text: 'hi' }]
    const segs = buildSegments(cues, 0, 0.9)
    expect(boundaries(segs)).toContain(0.3)
    expect(boundaries(segs)).toContain(0.6)
  })

  it('fully and contiguously covers the [from, to] window', () => {
    const cues = [
      { start: 1.2, end: 2.4, text: 'a' },
      { start: 3.0, end: 3.5, text: 'b' },
    ]
    const segs = buildSegments(cues, 0, 5)
    expect(segs[0].start).toBe(0)
    expect(coverage(segs)).toBeCloseTo(5, 6)
    // Each segment starts exactly where the previous ended.
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].start).toBeCloseTo(segs[i - 1].start + segs[i - 1].dur, 6)
    }
  })

  it('respects a trimmed window (segments stay inside [from, to])', () => {
    const cues = [{ start: 0.5, end: 4, text: 'x' }]
    const segs = buildSegments(cues, 1, 3)
    expect(segs[0].start).toBe(1)
    expect(coverage(segs)).toBeCloseTo(2, 6)
    // The cue start at 0.5 is outside the window and must not appear.
    expect(boundaries(segs)).not.toContain(0.5)
  })

  it('densifies the whole window when an overlay is active', () => {
    const staticSegs = buildSegments([], 0, 1)
    const overlaySegs = buildSegments([], 0, 1, 'none', 0, [], [], true)
    // Overlay forces ~30fps sampling, so far more segments than the static case.
    expect(overlaySegs.length).toBeGreaterThan(staticSegs.length)
    expect(coverage(overlaySegs)).toBeCloseTo(1, 6)
  })

  it('adds boundaries at image clip cut points', () => {
    const segs = buildSegments([], 0, 3, 'none', 0, [], [1.5])
    expect(boundaries(segs)).toContain(1.5)
  })

  it('ignores image cut points on the window edges', () => {
    const segs = buildSegments([], 0, 2, 'none', 0, [], [0, 2])
    expect(boundaries(segs)).not.toContain(2)
  })
})
