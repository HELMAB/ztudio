// Numeric properties that keyframes animate over time. A keyframe stores a
// snapshot of all of them, so the whole "scene" is interpolated between keys.
// Image framing is a static per-clip setting, so only caption position animates.
export const ANIMATED_FIELDS = ['offsetXPct', 'offsetYPct']

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
export function keyframeValues(keyframes, t) {
  if (!keyframes || keyframes.length === 0) {
    return null
  }

  const sorted = keyframes.length === 1 ? keyframes : [...keyframes].sort((a, b) => a.t - b.t)

  if (t <= sorted[0].t) {
    return sorted[0].values
  }
  const last = sorted[sorted.length - 1]
  if (t >= last.t) {
    return last.values
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
      for (const f of ANIMATED_FIELDS) {
        const av = a.values[f]
        const bv = b.values[f]
        out[f] = av + (bv - av) * e
      }
      return out
    }
  }

  return last.values
}

// Return a style object with the keyframe-interpolated values applied. The base
// style is returned untouched when there are no keyframes, so the static path
// allocates nothing.
export function applyKeyframes(style, keyframes, t) {
  const values = keyframeValues(keyframes, t)
  if (!values) {
    return style
  }
  return { ...style, ...values }
}
