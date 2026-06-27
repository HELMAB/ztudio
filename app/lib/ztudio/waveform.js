// Waveform peaks for the timeline's audio lane. Downsamples an AudioBuffer into a
// fixed set of peak magnitudes once (on load), then draws as a single stretchable
// SVG path so timeline zoom costs nothing — the path scales with the lane width.

// Peak magnitude (0..1) per bucket: the loudest absolute sample in each bucket
// across all channels, normalised so the loudest peak fills the height.
export function computePeaks(buffer, buckets) {
  const n = Math.max(1, Math.floor(buckets))
  const peaks = new Float32Array(n)
  const len = buffer.length
  if (len === 0) {
    return peaks
  }
  const chs = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    chs.push(buffer.getChannelData(c))
  }
  const per = len / n
  let max = 0
  for (let i = 0; i < n; i++) {
    const s0 = Math.floor(i * per)
    const s1 = Math.min(len, Math.floor((i + 1) * per))
    let peak = 0
    for (const ch of chs) {
      for (let s = s0; s < s1; s++) {
        const a = ch[s] < 0 ? -ch[s] : ch[s]
        if (a > peak) {
          peak = a
        }
      }
    }
    peaks[i] = peak
    if (peak > max) {
      max = peak
    }
  }
  if (max > 0) {
    for (let i = 0; i < n; i++) {
      peaks[i] /= max
    }
  }
  return peaks
}

// A bucket count scaled to duration (~20/sec), bounded so very short and very long
// tracks both stay reasonable. Peaks are computed once at this resolution; the SVG
// stretches to whatever width the current zoom gives the lane.
export const peakBuckets = duration => Math.min(2000, Math.max(200, Math.round(duration * 20)))

// Closed, mirrored SVG path for the peaks, in a viewBox of width = peaks.length and
// the given height (centre line at height/2). Render with preserveAspectRatio="none"
// so it fills the lane regardless of zoom.
export function peaksPath(peaks, height = 100) {
  const n = peaks.length
  if (!n) {
    return ''
  }
  const mid = height / 2
  const amp = mid * 0.96
  let d = `M 0 ${(mid - peaks[0] * amp).toFixed(2)}`
  for (let i = 1; i < n; i++) {
    d += ` L ${i} ${(mid - peaks[i] * amp).toFixed(2)}`
  }
  for (let i = n - 1; i >= 0; i--) {
    d += ` L ${i} ${(mid + peaks[i] * amp).toFixed(2)}`
  }
  return d + ' Z'
}
