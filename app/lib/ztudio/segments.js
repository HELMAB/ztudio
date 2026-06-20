import { ANIM_FRAME_STEP, MAX_FRAME_DUR } from './config'

// Sample [from, to] at a fixed step so animated stretches encode smoothly.
function densify(pts, from, to, step, total) {
  for (let t = from; t < to; t += step) {
    if (t > 0 && t < total) {
      pts.add(+t.toFixed(3))
    }
  }
}

export function buildSegments(cues, total, animType = 'none', animDur = 0, keyframeTimes = []) {
  const pts = new Set([0, total])
  const animated = animType && animType !== 'none' && animDur > 0

  for (const cue of cues) {
    if (cue.start > 0 && cue.start < total) {
      pts.add(cue.start)
    }
    if (cue.end > 0 && cue.end < total) {
      pts.add(cue.end)
    }
    if (animated) {
      // Dense frames only where motion happens: the enter and exit windows.
      const mid = (cue.start + cue.end) / 2
      densify(pts, cue.start, Math.min(cue.start + animDur, mid), ANIM_FRAME_STEP, total)
      densify(pts, Math.max(cue.end - animDur, mid), cue.end, ANIM_FRAME_STEP, total)
    }
  }

  // Keyframes: boundary at each key, and dense frames between adjacent keys where
  // values interpolate. Before the first / after the last key the scene is held.
  const kfs = [...keyframeTimes].filter(t => t > 0 && t < total).sort((a, b) => a - b)
  for (const t of kfs) {
    pts.add(+t.toFixed(3))
  }
  for (let i = 0; i < kfs.length - 1; i++) {
    densify(pts, kfs[i], kfs[i + 1], ANIM_FRAME_STEP, total)
  }

  for (let t = MAX_FRAME_DUR; t < total; t += MAX_FRAME_DUR) {
    pts.add(+t.toFixed(3))
  }

  const sorted = [...pts].filter(t => t >= 0 && t <= total).sort((a, b) => a - b)
  const segments = []

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]
    const dur = sorted[i + 1] - start
    if (dur > 1e-4) {
      segments.push({ start, dur })
    }
  }

  return segments
}
