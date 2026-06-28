import { afterEach, describe, expect, it, vi } from 'vitest'
import { mrType, sliceAudioBuffer } from '@/lib/ztudio/encoder'
import { MR_TYPES } from '@/lib/ztudio/config'

// Minimal AudioBuffer polyfill so sliceAudioBuffer's slicing branch can construct
// and copy without the Web Audio API.
class FakeAudioBuffer {
  constructor({ length, numberOfChannels, sampleRate }) {
    this.length = length
    this.numberOfChannels = numberOfChannels
    this.sampleRate = sampleRate
    this._ch = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }
  getChannelData(c) {
    return this._ch[c]
  }
  copyToChannel(src, c) {
    this._ch[c].set(src)
  }
}

// A source buffer (plain object is enough for the input side).
const srcBuffer = (samples, sampleRate = 10, channels = 1) => ({
  sampleRate,
  length: samples.length,
  numberOfChannels: channels,
  getChannelData: () => Float32Array.from(samples),
})

describe('sliceAudioBuffer', () => {
  it('returns the original buffer when the window spans the whole clip', () => {
    const buf = srcBuffer([1, 2, 3, 4])
    // 4 samples at 10Hz = 0.4s; window [0, 0.4] covers it exactly.
    expect(sliceAudioBuffer(buf, 0, 0.4)).toBe(buf)
  })

  it('returns the original buffer for an empty/inverted window', () => {
    const buf = srcBuffer([1, 2, 3, 4])
    expect(sliceAudioBuffer(buf, 0.3, 0.1)).toBe(buf)
  })

  it('copies only the windowed samples into a new, shorter buffer', () => {
    vi.stubGlobal('AudioBuffer', FakeAudioBuffer)
    const buf = srcBuffer([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) // 10 samples @ 10Hz = 1s
    const out = sliceAudioBuffer(buf, 0.2, 0.5) // samples [2,5)
    expect(out).not.toBe(buf)
    expect(out.length).toBe(3)
    expect([...out.getChannelData(0)]).toEqual([2, 3, 4])
  })

  it('clamps the window to the buffer bounds', () => {
    vi.stubGlobal('AudioBuffer', FakeAudioBuffer)
    const buf = srcBuffer([0, 1, 2, 3]) // 0.4s
    const out = sliceAudioBuffer(buf, 0.1, 5) // end clamps to length
    expect(out.length).toBe(3) // samples [1,4)
    expect([...out.getChannelData(0)]).toEqual([1, 2, 3])
  })
})

describe('mrType', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when MediaRecorder is unavailable', () => {
    // Node test env: no window/MediaRecorder.
    expect(mrType()).toBeNull()
  })

  it('returns the first supported MR type when present', () => {
    vi.stubGlobal('window', { MediaRecorder: {} })
    vi.stubGlobal('MediaRecorder', { isTypeSupported: t => t === MR_TYPES[MR_TYPES.length - 1] })
    expect(mrType()).toBe(MR_TYPES[MR_TYPES.length - 1])
  })
})
