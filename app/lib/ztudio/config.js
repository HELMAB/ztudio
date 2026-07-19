export const MAX_AUDIO_SEC = 300
export const MAX_FRAME_DUR = 1.0
// Duration of the caption enter/exit animation, in seconds.
export const ANIM_DURATION = 0.35
// Frame step used to densify the encode inside animation windows (~30fps).
export const ANIM_FRAME_STEP = 1 / 30
export const GREEN = '#00B140'
export const KHMER_FONT = '"Noto Sans Khmer", system-ui, sans-serif'

// dataTransfer type for dragging an image asset row onto the timeline. OS file
// drags (type 'Files') stay with the app-wide DropZone overlay instead.
export const IMAGE_DRAG_MIME = 'application/x-ztudio-image'

// Resolve a font selection (the `value` from fontOptions: 'default', a bundled
// Khmer family, or a custom FontFace family) to a CSS font stack with the Khmer
// fallback. Shared by the caption style and the title-text overlays.
export const buildFontStack = sel =>
  !sel || sel === 'default' ? KHMER_FONT : `"${sel}", "Noto Sans Khmer", system-ui, sans-serif`

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
  // Whole-block rotation in degrees, pivoting on the caption centre. Static
  // (not keyframed), like image rotation.
  captionRotation: 0,
  box: false,
  boxColor: 'rgba(0,0,0,0.55)',
  highlightWord: true,
  highlightColor: '#00e0a4',
  highlightStyle: 'text',
  lineHeight: 1.34,
  topMarginPct: 0.09,
  bottomMarginPct: 0.09,
  animation: 'none',
  animDuration: ANIM_DURATION,
  overlay: 'leaves',
  overlayIntensity: 1,
  transition: 'none',
  transitionDuration: 0.5,
  // Background painted behind contained images and in clip gaps. 'green' keeps the
  // chroma key; 'color'/'gradient' use bgColor(/bgColor2); 'blur' fills with a
  // blurred cover-crop of the current image (letterbox-bars look for portrait).
  bgMode: 'green',
  bgColor: '#101014',
  bgColor2: '#26263a',
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

// Background fill modes. `green` is the chroma key; `color`/`gradient` use the
// bgColor controls; `blur` fills with a blurred cover-crop of the current image.
export const BACKGROUND_OPTIONS = [
  { value: 'green', labelKey: 'bg.green' },
  { value: 'black', labelKey: 'bg.black' },
  { value: 'white', labelKey: 'bg.white' },
  { value: 'color', labelKey: 'bg.color' },
  { value: 'gradient', labelKey: 'bg.gradient' },
  { value: 'blur', labelKey: 'bg.blur' },
]

// Transitions between adjacent slideshow image clips, applied at every clip
// boundary. `crossfade` dissolves the outgoing clip into the incoming one;
// `dipBlack`/`dipWhite` fade the incoming clip up from a colour; `slideLeft`/
// `slideRight` push the incoming clip in over the previous one. All run over
// `transitionDuration`.
export const TRANSITION_OPTIONS = [
  { value: 'none', labelKey: 'transitionOpt.none' },
  { value: 'crossfade', labelKey: 'transitionOpt.crossfade' },
  { value: 'dipBlack', labelKey: 'transitionOpt.dipBlack' },
  { value: 'dipWhite', labelKey: 'transitionOpt.dipWhite' },
  { value: 'slideLeft', labelKey: 'transitionOpt.slideLeft' },
  { value: 'slideRight', labelKey: 'transitionOpt.slideRight' },
]

// Export quality → mediabunny quality constant name (resolved at encode time) and
// a realtime MediaRecorder video bitrate fallback.
export const QUALITY_OPTIONS = [
  // Crispest text/edges — maps to mediabunny's QUALITY_VERY_HIGH (the encoder
  // falls back to QUALITY_HIGH if the preset name isn't present in the loaded
  // build). Largest files, best for subtitle-heavy 1080p output.
  {
    value: 'veryhigh',
    labelKey: 'quality.veryhigh',
    mbKey: 'QUALITY_VERY_HIGH',
    mrBitrate: 14_000_000,
  },
  { value: 'high', labelKey: 'quality.high', mbKey: 'QUALITY_HIGH', mrBitrate: 8_000_000 },
  { value: 'medium', labelKey: 'quality.medium', mbKey: 'QUALITY_MEDIUM', mrBitrate: 5_000_000 },
  { value: 'low', labelKey: 'quality.low', mbKey: 'QUALITY_LOW', mrBitrate: 2_500_000 },
]

// Container preference for the fast (WebCodecs) path. 'auto' prefers MP4 then
// falls back to WebM; the explicit choices force one container.
export const FORMAT_OPTIONS = [
  { value: 'auto', labelKey: 'format.auto' },
  { value: 'mp4', labelKey: 'format.mp4' },
  { value: 'webm', labelKey: 'format.webm' },
]

// Frame rate ceiling for animated stretches (the variable-segment encode still
// emits long static frames where nothing moves).
export const FPS_OPTIONS = [
  { value: 30, labelKey: 'fps.30' },
  { value: 24, labelKey: 'fps.24' },
  { value: 60, labelKey: 'fps.60' },
]

// Default export settings (bitrate, container, frame rate).
export const EXPORT_DEFAULTS = { quality: 'high', format: 'auto', fps: 30 }

// Watermark/logo corners and its default framing (size as a fraction of the
// frame width, opacity, and inset from the edges).
export const LOGO_POSITION_OPTIONS = [
  { value: 'topLeft', labelKey: 'logo.topLeft' },
  { value: 'topRight', labelKey: 'logo.topRight' },
  { value: 'bottomLeft', labelKey: 'logo.bottomLeft' },
  { value: 'bottomRight', labelKey: 'logo.bottomRight' },
]

// `start`/`end` bound when the logo is visible; end === 0 means "to the end", so
// a fresh logo shows for the whole video until its timeline clip is trimmed.
export const LOGO_DEFAULTS = {
  position: 'topRight',
  scalePct: 0.1,
  opacity: 0.9,
  marginPct: 0.04,
  rotation: 0,
  start: 0,
  end: 0,
}

// Anchor presets for a text overlay, mapped to normalized (x, y) centre points.
export const TEXT_ANCHOR_OPTIONS = [
  { value: 'top', labelKey: 'textOverlay.anchorTop', x: 0.5, y: 0.16 },
  { value: 'center', labelKey: 'textOverlay.anchorCenter', x: 0.5, y: 0.5 },
  { value: 'bottom', labelKey: 'textOverlay.anchorBottom', x: 0.5, y: 0.84 },
]

// Karaoke word-highlight styles: recolour the spoken word, or put a filled pill
// behind it (Hormozi-style).
export const HIGHLIGHT_STYLE_OPTIONS = [
  { value: 'text', labelKey: 'highlight.styleText' },
  { value: 'fill', labelKey: 'highlight.styleFill' },
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
