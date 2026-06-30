import { describe, expect, it } from 'vitest'
import { EXPORT_DEFAULTS, KHMER_FONT, QUALITY_OPTIONS, buildFontStack } from '@/lib/ztudio/config'
import { OVERLAY_OPTIONS, OVERLAY_PRESETS, isOverlayActive } from '@/lib/ztudio/overlays'
import en from '../../i18n/locales/en.json'
import km from '../../i18n/locales/km.json'

const at = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)

describe('buildFontStack', () => {
  it("returns the Khmer fallback stack for 'default' or empty selections", () => {
    expect(buildFontStack('default')).toBe(KHMER_FONT)
    expect(buildFontStack('')).toBe(KHMER_FONT)
    expect(buildFontStack(undefined)).toBe(KHMER_FONT)
  })

  it('prepends a chosen family, keeping the Khmer fallback', () => {
    const stack = buildFontStack('Battambang')
    expect(stack.startsWith('"Battambang"')).toBe(true)
    expect(stack).toContain('Noto Sans Khmer')
  })
})

describe('overlay options', () => {
  it("every selectable overlay (except 'none') has a preset", () => {
    for (const opt of OVERLAY_OPTIONS) {
      if (opt.value === 'none') {
        continue
      }
      expect(OVERLAY_PRESETS[opt.value], `missing preset for ${opt.value}`).toBeDefined()
    }
  })

  it('every option carries an i18n label key', () => {
    for (const opt of OVERLAY_OPTIONS) {
      expect(opt.labelKey).toBe(`overlay.opt.${opt.value}`)
    }
  })
})

describe('export quality options', () => {
  it('exposes a very-high tier mapping to mediabunny QUALITY_VERY_HIGH', () => {
    const vh = QUALITY_OPTIONS.find(o => o.value === 'veryhigh')
    expect(vh, 'very-high quality option').toBeDefined()
    expect(vh.mbKey).toBe('QUALITY_VERY_HIGH')
    // Its realtime fallback should out-bitrate the previous top tier (high = 8M).
    expect(vh.mrBitrate).toBeGreaterThan(8_000_000)
  })

  it('every quality carries a QUALITY_ preset key, a positive bitrate, and labels in both locales', () => {
    for (const o of QUALITY_OPTIONS) {
      expect(o.mbKey, `mbKey for ${o.value}`).toMatch(/^QUALITY_/)
      expect(o.mrBitrate, `mrBitrate for ${o.value}`).toBeGreaterThan(0)
      expect(at(en, o.labelKey), `en label ${o.labelKey}`).toBeTruthy()
      expect(at(km, o.labelKey), `km label ${o.labelKey}`).toBeTruthy()
    }
  })

  it('the default export quality is a real option', () => {
    expect(QUALITY_OPTIONS.some(o => o.value === EXPORT_DEFAULTS.quality)).toBe(true)
  })
})

describe('isOverlayActive', () => {
  it('is false for none/empty/unknown keys', () => {
    expect(isOverlayActive('none')).toBe(false)
    expect(isOverlayActive('')).toBe(false)
    expect(isOverlayActive(null)).toBe(false)
    expect(isOverlayActive('bogus')).toBe(false)
  })

  it('is true for a real preset key', () => {
    expect(isOverlayActive('leaves')).toBe(true)
  })
})
