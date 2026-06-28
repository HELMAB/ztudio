import { describe, expect, it } from 'vitest'
import { KHMER_FONT, buildFontStack } from '@/lib/ztudio/config'
import { OVERLAY_OPTIONS, OVERLAY_PRESETS, isOverlayActive } from '@/lib/ztudio/overlays'

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
