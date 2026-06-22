export const MAX_AUDIO_SEC = 300
export const MAX_FRAME_DUR = 1.0
// Duration of the caption enter/exit animation, in seconds.
export const ANIM_DURATION = 0.35
// Frame step used to densify the encode inside animation windows (~30fps).
export const ANIM_FRAME_STEP = 1 / 30
export const GREEN = '#00B140'
export const KHMER_FONT = '"Noto Sans Khmer", system-ui, sans-serif'

// Title-safe inset (fraction of each edge) for the preview-only safe-area
// overlay. Captions kept inside this margin won't be clipped or hidden behind
// platform UI on phones/TVs. This is a guide only — it never affects the encode.
export const SAFE_AREA_PCT = 0.05

export const MR_TYPES = [
  'video/mp4;codecs=h264,aac',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export const DEFAULT_STYLE = {
  fontFamily: KHMER_FONT,
  fontSizePct: 0.03,
  fontWeight: 700,
  fill: '#ffffff',
  strokeColor: '#000000',
  strokePct: 0.16,
  position: 'bottom',
  offsetXPct: 0,
  offsetYPct: 0,
  box: false,
  boxColor: 'rgba(0,0,0,0.55)',
  lineHeight: 1.34,
  topMarginPct: 0.09,
  bottomMarginPct: 0.09,
  animation: 'none',
  animDuration: ANIM_DURATION,
}

export const PRESETS = {
  clean: {
    size: 0.03,
    weight: 700,
    fill: '#ffffff',
    stroke: '#000000',
    strokew: 0.16,
    pos: 'bottom',
    box: false,
  },
  yellow: {
    size: 0.058,
    weight: 700,
    fill: '#ffe14d',
    stroke: '#000000',
    strokew: 0.2,
    pos: 'bottom',
    box: false,
  },
  boxed: {
    size: 0.052,
    weight: 700,
    fill: '#ffffff',
    stroke: '#000000',
    strokew: 0.0,
    pos: 'bottom',
    box: true,
  },
  tiktok: {
    size: 0.062,
    weight: 700,
    fill: '#ffffff',
    stroke: '#000000',
    strokew: 0.22,
    pos: 'center',
    box: false,
  },
}

export const RESOLUTION_OPTIONS = [
  { value: '1080x1920', labelKey: 'resolution.1080x1920' },
  { value: '720x1280', labelKey: 'resolution.720x1280' },
  { value: '1920x1080', labelKey: 'resolution.1920x1080' },
  { value: '1080x1080', labelKey: 'resolution.1080x1080' },
]

export const PRESET_OPTIONS = [
  { value: 'clean', labelKey: 'preset.clean' },
  { value: 'yellow', labelKey: 'preset.yellow' },
  { value: 'boxed', labelKey: 'preset.boxed' },
  { value: 'tiktok', labelKey: 'preset.tiktok' },
  { value: 'custom', labelKey: 'preset.custom' },
]

export const WEIGHT_OPTIONS = [
  { value: '700', labelKey: 'weightOpt.700' },
  { value: '400', labelKey: 'weightOpt.400' },
]

export const POSITION_OPTIONS = [
  { value: 'bottom', labelKey: 'position.bottom' },
  { value: 'center', labelKey: 'position.center' },
  { value: 'top', labelKey: 'position.top' },
]

export const FIT_OPTIONS = [
  { value: 'contain', labelKey: 'fit.contain' },
  { value: 'cover', labelKey: 'fit.cover' },
]

// Per-image effects. `filter` is a canvas 2D `ctx.filter` string, applied to the
// image draw only (so preview and export match). `none` skips filtering.
export const IMAGE_EFFECTS = [
  { value: 'none', labelKey: 'effect.none', filter: 'none' },
  { value: 'mono', labelKey: 'effect.mono', filter: 'grayscale(1)' },
  { value: 'sepia', labelKey: 'effect.sepia', filter: 'sepia(0.85)' },
  {
    value: 'vintage',
    labelKey: 'effect.vintage',
    filter: 'sepia(0.4) contrast(1.1) brightness(1.05) saturate(1.2)',
  },
  { value: 'vivid', labelKey: 'effect.vivid', filter: 'saturate(1.6) contrast(1.15)' },
  {
    value: 'cool',
    labelKey: 'effect.cool',
    filter: 'hue-rotate(-15deg) saturate(1.2) brightness(1.03)',
  },
  { value: 'warm', labelKey: 'effect.warm', filter: 'sepia(0.3) saturate(1.4) brightness(1.05)' },
  {
    value: 'fade',
    labelKey: 'effect.fade',
    filter: 'contrast(0.85) brightness(1.1) saturate(0.85)',
  },
  { value: 'noir', labelKey: 'effect.noir', filter: 'grayscale(1) contrast(1.4) brightness(0.95)' },
  { value: 'dream', labelKey: 'effect.dream', filter: 'blur(6px) brightness(1.1) saturate(1.3)' },
  { value: 'invert', labelKey: 'effect.invert', filter: 'invert(1)' },
]

export const ANIMATION_OPTIONS = [
  { value: 'none', labelKey: 'anim.none' },
  { value: 'fade', labelKey: 'anim.fade' },
  { value: 'slideUp', labelKey: 'anim.slideUp' },
  { value: 'slideDown', labelKey: 'anim.slideDown' },
  { value: 'slideLeft', labelKey: 'anim.slideLeft' },
  { value: 'slideRight', labelKey: 'anim.slideRight' },
  { value: 'pop', labelKey: 'anim.pop' },
  { value: 'zoom', labelKey: 'anim.zoom' },
  { value: 'blur', labelKey: 'anim.blur' },
  { value: 'typewriter', labelKey: 'anim.typewriter' },
  { value: 'wordByWord', labelKey: 'anim.wordByWord' },
]
