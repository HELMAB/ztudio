import { describe, expect, it } from 'vitest'
import { computePeaks, peakBuckets, peaksPath } from '@/lib/ztudio/waveform'

// Minimal AudioBuffer stand-in: computePeaks only uses length, numberOfChannels
// and getChannelData, so a plain object is enough (no Web Audio needed).
const fakeBuffer = (...channels) => ({
  length: channels[0].length,
  numberOfChannels: channels.length,
  getChannelData: c => channels[c],
})

describe('computePeaks', () => {
  it('returns the requested number of buckets', () => {
    const buf = fakeBuffer(new Float32Array(100))
    expect(computePeaks(buf, 10)).toHaveLength(10)
  })

  it('normalizes the loudest peak to 1', () => {
    const buf = fakeBuffer(Float32Array.from([0.1, 0.5, -0.25, 0.05]))
    const peaks = computePeaks(buf, 4)
    expect(Math.max(...peaks)).toBeCloseTo(1, 6)
  })

  it('uses absolute magnitude so negative samples count', () => {
    const buf = fakeBuffer(Float32Array.from([-1, 0]))
    const peaks = computePeaks(buf, 2)
    expect(peaks[0]).toBeCloseTo(1, 6)
  })

  it('takes the max across channels', () => {
    const buf = fakeBuffer(Float32Array.from([0.2]), Float32Array.from([0.9]))
    const peaks = computePeaks(buf, 1)
    expect(peaks[0]).toBeCloseTo(1, 6)
  })

  it('returns all-zero peaks for an empty buffer', () => {
    const peaks = computePeaks(fakeBuffer(new Float32Array(0)), 5)
    expect([...peaks]).toEqual([0, 0, 0, 0, 0])
  })

  it('clamps bucket count to at least 1', () => {
    expect(computePeaks(fakeBuffer(Float32Array.from([1])), 0)).toHaveLength(1)
  })
})

describe('peakBuckets', () => {
  it('scales roughly with duration (~20/sec)', () => {
    expect(peakBuckets(50)).toBe(1000)
  })

  it('clamps to a minimum of 200', () => {
    expect(peakBuckets(1)).toBe(200)
  })

  it('clamps to a maximum of 2000', () => {
    expect(peakBuckets(99999)).toBe(2000)
  })
})

describe('peaksPath', () => {
  it('returns an empty string for no peaks', () => {
    expect(peaksPath(new Float32Array(0))).toBe('')
  })

  it('produces a closed path starting with a move command', () => {
    const d = peaksPath(Float32Array.from([0, 1, 0.5]), 100)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })
})
