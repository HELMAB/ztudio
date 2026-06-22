// Numeric properties that keyframes animate over time. A keyframe stores a
// snapshot of all of them, so the whole "scene" is interpolated between keys.
// Caption position is global (interpolates across the whole timeline); image
// framing is sourced from the clip on screen and only interpolates between
// keyframes that fall inside that clip's time range (see imageFramingAt).
export const CAPTION_FIELDS = ['offsetXPct', 'offsetYPct']
export const IMAGE_FIELDS = ['imageZoom', 'imageOffsetXPct', 'imageOffsetYPct']
export const ANIMATED_FIELDS = [...CAPTION_FIELDS, ...IMAGE_FIELDS]

export const EASINGS = {
  linear: t => t,
  easeIn: t => t * t,
  easeOut: t => 1 - (1 - t) * (1 - t),
  easeInOut: t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
}

export const EASING_KEYS = Object.keys(EASINGS)
export const DEFAULT_EASING = 'easeInOut'

// Interpolated values at time t, or null when there are no keyframes. Before the
// first / after the last keyframe the nearest value is held (no extrapolation).
// The easing belongs to the destination keyframe (the transition into it).
// `fields` limits which properties are interpolated (caption vs image), so the
// same routine can be reused with a pre-filtered keyframe subset.
export function keyframeValues(keyframes, t, fields = ANIMATED_FIELDS) {
  if (!keyframes || keyframes.length === 0) {
    return null
  }

  const pick = values => {
    const out = {}
    for (const f of fields) {
      out[f] = values[f]
    }
    return out
  }

  const sorted = keyframes.length === 1 ? keyframes : [...keyframes].sort((a, b) => a.t - b.t)

  if (t <= sorted[0].t) {
    return pick(sorted[0].values)
  }
  const last = sorted[sorted.length - 1]
  if (t >= last.t) {
    return pick(last.values)
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t
      const p = span > 0 ? (t - a.t) / span : 0
      const ease = EASINGS[b.easing] || EASINGS[DEFAULT_EASING]
      const e = ease(p)
      const out = {}
      for (const f of fields) {
        const av = a.values[f]
        const bv = b.values[f]
        out[f] = av + (bv - av) * e
      }
      return out
    }
  }

  return pick(last.values)
}

// Return a style object with the keyframe-interpolated caption position applied.
// The base style is returned untouched when there are no keyframes, so the static
// path allocates nothing. Image framing is resolved separately (imageFramingAt).
export function applyKeyframes(style, keyframes, t) {
  const values = keyframeValues(keyframes, t, CAPTION_FIELDS)
  if (!values) {
    return style
  }
  return { ...style, ...values }
}

// Resolve an image clip's framing (zoom + pan) at time t. Only keyframes whose
// time falls inside the clip's own [start, end) window animate it, so a clip
// boundary is a hard cut and motion never bleeds across clips. Clips with no
// keyframes in their span keep their static framing.
export function imageFramingAt(img, keyframes, t) {
  const base = {
    zoom: img.zoom || 1,
    offsetXPct: img.offsetXPct || 0,
    offsetYPct: img.offsetYPct || 0,
  }
  const scoped = (keyframes || []).filter(k => k.t >= img.start && k.t < img.end)
  if (!scoped.length) {
    return base
  }
  const v = keyframeValues(scoped, t, IMAGE_FIELDS)
  return {
    zoom: v.imageZoom,
    offsetXPct: v.imageOffsetXPct,
    offsetYPct: v.imageOffsetYPct,
  }
}
