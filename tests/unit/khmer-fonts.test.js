import { describe, expect, it } from 'vitest'
import { KHMER_FONTS } from '@/lib/ztudio/khmer-fonts'

describe('KHMER_FONTS registry', () => {
  it('is a non-empty list', () => {
    expect(KHMER_FONTS.length).toBeGreaterThan(0)
  })

  it('gives every font a family, label, file and resolved url', () => {
    for (const f of KHMER_FONTS) {
      expect(f.family, 'family').toBeTruthy()
      expect(f.label, 'label').toBeTruthy()
      expect(f.file, `file for ${f.family}`).toMatch(/\.ttf$/)
      expect(f.url, `url for ${f.family}`).toBe(`/fonts/khmer/${f.file}`)
    }
  })

  it('has unique family names and file paths', () => {
    const families = KHMER_FONTS.map(f => f.family)
    const files = KHMER_FONTS.map(f => f.file)
    expect(new Set(families).size).toBe(families.length)
    expect(new Set(files).size).toBe(files.length)
  })
})
