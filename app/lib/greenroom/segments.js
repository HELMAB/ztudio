import { MAX_FRAME_DUR } from './config'

export function buildSegments(cues, total) {
  const pts = new Set([0, total])

  for (const cue of cues) {
    if (cue.start > 0 && cue.start < total) {
      pts.add(cue.start)
    }
    if (cue.end > 0 && cue.end < total) {
      pts.add(cue.end)
    }
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
