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

export function captionAt(t, cues) {
  const cue = cueAt(t, cues)
  return cue ? cue.text : ''
}
