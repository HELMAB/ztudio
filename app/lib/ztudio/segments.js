import { ANIM_FRAME_STEP, MAX_FRAME_DUR } from './config'

// Sample [start, end] at a fixed step so animated stretches encode smoothly,
// keeping every point strictly inside the (lo, hi) window.
function densify(pts, start, end, step, lo, hi) {
  for (let t = start; t < end; t += step) {
    if (t > lo && t < hi) {
      pts.add(+t.toFixed(3))
    }
  }
}

// Build variable-length frames over the [from, to] window (absolute media time).
// When trimming, `from` is the trim start so segments cover only the kept range;
// the caller offsets each segment's timestamp by `from` for the output stream.
export function buildSegments(
  cues,
  from,
  to,
  animType = 'none',
  animDur = 0,
  keyframeTimes = [],
  imageTimes = [],
  overlayActive = false,
) {
  const pts = new Set([from, to])
  const animated = animType && animType !== 'none' && animDur > 0

  // A continuous overlay (rain/snow/…) moves every frame, so the whole window
  // must be sampled at the animation rate — this forgoes the static-frame
  // speed-up and is the cost of enabling an overlay.
  if (overlayActive) {
    for (let t = from; t < to; t += ANIM_FRAME_STEP) {
      pts.add(+t.toFixed(3))
    }
  }

  // Each image clip's start/end is a hard cut, so it must land on a frame boundary.
  for (const t of imageTimes) {
    if (t > from && t < to) {
      pts.add(+t.toFixed(3))
    }
  }

  for (const cue of cues) {
    if (cue.start > from && cue.start < to) {
      pts.add(cue.start)
    }
    if (cue.end > from && cue.end < to) {
      pts.add(cue.end)
    }
    if (animated) {
      // Dense frames only where motion happens: the enter and exit windows.
      const mid = (cue.start + cue.end) / 2
      densify(pts, cue.start, Math.min(cue.start + animDur, mid), ANIM_FRAME_STEP, from, to)
      densify(pts, Math.max(cue.end - animDur, mid), cue.end, ANIM_FRAME_STEP, from, to)
    }
  }

  // Keyframes: boundary at each key, and dense frames between adjacent keys where
  // values interpolate. Before the first / after the last key the scene is held.
  // Keep ALL keys (sorted) for the pairwise sweep so a key sitting exactly on the
  // window edge — e.g. the first key at t=0 when untrimmed — still bounds a span
  // that gets densified; otherwise that whole stretch would encode as static
  // MAX_FRAME_DUR frames and the motion looks jerky. densify clamps every emitted
  // point to (from, to), so edge keys are safe to include here. Only strictly
  // inside keys become their own cut point.
  const kfs = [...keyframeTimes].sort((a, b) => a - b)
  for (const t of kfs) {
    if (t > from && t < to) {
      pts.add(+t.toFixed(3))
    }
  }
  for (let i = 0; i < kfs.length - 1; i++) {
    densify(pts, kfs[i], kfs[i + 1], ANIM_FRAME_STEP, from, to)
  }

  for (let t = from + MAX_FRAME_DUR; t < to; t += MAX_FRAME_DUR) {
    pts.add(+t.toFixed(3))
  }

  const sorted = [...pts].filter(t => t >= from && t <= to).sort((a, b) => a - b)
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
