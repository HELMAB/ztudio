import { describe, expect, it } from 'vitest'
import { AUDIO_DEFAULTS } from '@/lib/ztudio/audio'

describe('AUDIO_DEFAULTS', () => {
  it('exposes the expected mix defaults', () => {
    expect(AUDIO_DEFAULTS).toEqual({
      voiceGain: 1,
      voiceFadeIn: 0,
      voiceFadeOut: 0,
      musicGain: 0.45,
      musicFadeIn: 1,
      musicFadeOut: 1.5,
      musicLoop: true,
      ducking: true,
      duckAmount: 0.75,
    })
  })

  it('keeps gains and fades within sane, non-negative ranges', () => {
    expect(AUDIO_DEFAULTS.voiceGain).toBeGreaterThan(0)
    expect(AUDIO_DEFAULTS.musicGain).toBeGreaterThan(0)
    expect(AUDIO_DEFAULTS.musicGain).toBeLessThanOrEqual(1)
    expect(AUDIO_DEFAULTS.duckAmount).toBeGreaterThan(0)
    expect(AUDIO_DEFAULTS.duckAmount).toBeLessThan(1)
    for (const k of ['voiceFadeIn', 'voiceFadeOut', 'musicFadeIn', 'musicFadeOut']) {
      expect(AUDIO_DEFAULTS[k]).toBeGreaterThanOrEqual(0)
    }
  })
})
