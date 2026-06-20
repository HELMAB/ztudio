export const MAX_AUDIO_SEC = 300
export const MAX_FRAME_DUR = 1.0
export const GREEN = '#00B140'
export const KHMER_FONT = '"Noto Sans Khmer", system-ui, sans-serif'

export const MR_TYPES = [
  'video/mp4;codecs=h264,aac',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export const DEFAULT_STYLE = {
  fontFamily: KHMER_FONT,
  fontSizePct: 0.055,
  fontWeight: 700,
  fill: '#ffffff',
  strokeColor: '#000000',
  strokePct: 0.16,
  position: 'bottom',
  box: false,
  boxColor: 'rgba(0,0,0,0.55)',
  lineHeight: 1.34,
  topMarginPct: 0.09,
  bottomMarginPct: 0.09,
}

export const PRESETS = {
  clean: {
    size: 0.055,
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
  { value: '1080x1920', label: '1080 × 1920 — TikTok / Reels / Shorts (9:16)' },
  { value: '720x1280', label: '720 × 1280 — faster test (9:16)' },
  { value: '1920x1080', label: '1920 × 1080 — YouTube (16:9)' },
  { value: '1080x1080', label: '1080 × 1080 — Facebook square (1:1)' },
]

export const PRESET_OPTIONS = [
  { value: 'clean', label: 'Clean White' },
  { value: 'yellow', label: 'Yellow Pop' },
  { value: 'boxed', label: 'Boxed' },
  { value: 'tiktok', label: 'TikTok Bold' },
  { value: 'custom', label: 'Custom' },
]

export const WEIGHT_OPTIONS = [
  { value: '700', label: 'Bold' },
  { value: '400', label: 'Regular' },
]

export const POSITION_OPTIONS = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
]

export const FIT_OPTIONS = [
  { value: 'contain', label: 'Contain (fit, green bars)' },
  { value: 'cover', label: 'Cover (fill, crop)' },
]
