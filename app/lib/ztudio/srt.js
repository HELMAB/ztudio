const TC = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/

export function parseSRT(text) {
  const normalised = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const cues = []

  for (const block of normalised.split(/\n{2,}/)) {
    const raw = block.split('\n')
    const idx = raw.findIndex(line => TC.test(line))
    if (idx === -1) {
      continue
    }

    const m = raw[idx].match(TC)
    const start = +m[1] * 3600 + +m[2] * 60 + +m[3] + +('0.' + m[4])
    const end = +m[5] * 3600 + +m[6] * 60 + +m[7] + +('0.' + m[8])
    const lines = raw
      .slice(idx + 1)
      .map(line => line.replace(/\s+$/, ''))
      .filter(line => line.trim().length)

    if (end > start && lines.length) {
      cues.push({ start, end, text: lines.join('\n') })
    }
  }

  cues.sort((a, b) => a.start - b.start)
  return cues
}

export function cueAt(t, cues) {
  return cues.find(c => t >= c.start && t < c.end) || null
}

// Words in a caption, whitespace-delimited (matches the word-by-word reveal).
// Newlines count as separators, so the order is reading order across lines.
export const splitWords = text => (text ? text.split(/\s+/).filter(Boolean) : [])
export const wordCount = text => splitWords(text).length

// Index of the word "spoken" at time t within a cue. SRT has no per-word timing,
// so words are distributed evenly across the cue's duration. Returns -1 when the
// cue has no words.
export function activeWordIndex(t, cue) {
  const total = wordCount(cue.text)
  if (total <= 0) {
    return -1
  }
  const span = cue.end - cue.start
  const p = span > 0 ? (t - cue.start) / span : 0
  const clamped = p < 0 ? 0 : p > 1 ? 1 : p
  return Math.min(total - 1, Math.floor(clamped * total))
}

// Times (within a cue) at which the highlighted word advances — used by the
// encoder to place a frame boundary at each word so the highlight stays in sync.
export function wordBoundaryTimes(cue) {
  const total = wordCount(cue.text)
  const span = cue.end - cue.start
  const out = []
  for (let i = 1; i < total; i++) {
    out.push(cue.start + (i / total) * span)
  }
  return out
}

export function captionAt(t, cues) {
  const cue = cueAt(t, cues)
  return cue ? cue.text : ''
}
