// Full-frame ambiance overlays: rain, snow, falling leaves/petals, bokeh, etc.
//
// Every particle's position is a pure, deterministic function of the frame time
// `t` (no Math.random, no per-frame state), so the live preview and the encode
// draw identical frames — exactly like captions and keyframes. Continuous motion
// means an active overlay forces the encoder to sample the whole timeline at
// ~30fps (see buildSegments), trading the static-frame speed-up for animation.

const TAU = Math.PI * 2

// Deterministic pseudo-random in [0,1) from a particle index and a salt, so each
// particle keeps stable per-instance traits (speed, phase, size, colour) frame to
// frame without storing anything.
function rand(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 4.1414) * 43758.5453
  return x - Math.floor(x)
}

const lerp = (a, b, p) => a + (b - a) * p
const pickColor = (colors, i) => colors[Math.floor(rand(i, 9) * colors.length) % colors.length]

// Thin near-vertical streaks driven downward, with an optional wind lean.
function drawRain(ctx, w, h, t, p, count) {
  const len = h * p.length
  ctx.strokeStyle = p.color
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1, w * p.width)
  for (let i = 0; i < count; i++) {
    const speed = lerp(p.speedMin, p.speedMax, rand(i, 1))
    const x0 = rand(i, 2) * w
    const phase = (rand(i, 3) + t * speed) % 1
    const y = phase * (h + len) - len
    const x = x0 + phase * p.wind * w
    ctx.globalAlpha = p.opacity * (0.5 + rand(i, 4) * 0.5)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - p.wind * len, y - len)
    ctx.stroke()
  }
}

// Round particles with horizontal sway: snow, dust, bokeh, sparkles, embers,
// fireflies. `dir` -1 makes them rise; `glow` adds a soft halo; `twinkle` pulses
// the alpha. Nearer (bigger) particles fall faster and sway wider for depth.
function drawDots(ctx, w, h, t, p, count) {
  const u = Math.min(w, h)
  const dir = p.dir || 1
  for (let i = 0; i < count; i++) {
    const depth = rand(i, 2)
    const r = lerp(p.sizeMin, p.sizeMax, depth) * u
    const speed = lerp(p.speedMin, p.speedMax, rand(i, 1))
    const travel = (rand(i, 3) + t * speed) % 1
    const along = dir === 1 ? travel : 1 - travel
    const y = along * (h + 2 * r) - r
    const swayAmp = p.sway * w * (0.4 + depth * 0.6)
    const x = rand(i, 4) * w + Math.sin(t * p.swaySpeed + i * 1.7) * swayAmp

    let a = p.opacity * (0.35 + depth * 0.65)
    if (p.twinkle) {
      a *= 0.35 + 0.65 * Math.abs(Math.sin(t * p.twinkle + i * 2.1))
    }
    ctx.globalAlpha = a
    ctx.fillStyle = pickColor(p.colors, i)
    if (p.glow) {
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = r * 2.2
    }
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

function shapePath(ctx, shape, s) {
  if (shape === 'rect') {
    ctx.fillRect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.9)
    return
  }
  if (shape === 'petal') {
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.55, s, 0, 0, TAU)
    ctx.fill()
    return
  }
  // Pointed leaf.
  ctx.beginPath()
  ctx.moveTo(0, -s)
  ctx.bezierCurveTo(s * 0.85, -s * 0.4, s * 0.85, s * 0.4, 0, s)
  ctx.bezierCurveTo(-s * 0.85, s * 0.4, -s * 0.85, -s * 0.4, 0, -s)
  ctx.fill()
}

// Tumbling shapes drifting down: leaves, blossom petals, confetti. Each spins and
// flips (a cosine y-scale fakes a 3D tumble) and sways on a wide arc as it falls.
function drawFalling(ctx, w, h, t, p, count) {
  const u = Math.min(w, h)
  for (let i = 0; i < count; i++) {
    const size = lerp(p.sizeMin, p.sizeMax, rand(i, 2)) * u
    const speed = lerp(p.speedMin, p.speedMax, rand(i, 1))
    const travel = (rand(i, 3) + t * speed) % 1
    const y = travel * (h + size * 3) - size * 1.5
    const x = rand(i, 4) * w + Math.sin(t * p.swaySpeed + i * 2.3) * p.sway * w
    const spin = lerp(p.spinMin, p.spinMax, rand(i, 5))
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(t * spin + i)
    ctx.scale(1, 0.55 + 0.45 * Math.cos(t * spin * 1.3 + i))
    ctx.globalAlpha = p.opacity
    ctx.fillStyle = pickColor(p.colors, i)
    shapePath(ctx, p.shape, size)
    ctx.restore()
  }
}

// Preset registry. `base` selects the renderer; the rest are per-effect tuning.
// speed* are fall cycles/sec; size* and sway are fractions of the frame.
export const OVERLAY_PRESETS = {
  rainLight: {
    base: 'rain',
    color: 'rgb(190,205,230)',
    opacity: 0.45,
    count: 120,
    speedMin: 0.7,
    speedMax: 1.1,
    length: 0.05,
    width: 0.0016,
    wind: 0.04,
  },
  rainHeavy: {
    base: 'rain',
    color: 'rgb(200,215,235)',
    opacity: 0.55,
    count: 260,
    speedMin: 1.2,
    speedMax: 1.8,
    length: 0.07,
    width: 0.0022,
    wind: 0.12,
  },
  snowGentle: {
    base: 'dots',
    colors: ['#ffffff'],
    opacity: 0.85,
    count: 90,
    speedMin: 0.08,
    speedMax: 0.18,
    sizeMin: 0.004,
    sizeMax: 0.011,
    sway: 0.03,
    swaySpeed: 0.6,
  },
  snowHeavy: {
    base: 'dots',
    colors: ['#ffffff', '#eef4ff'],
    opacity: 0.9,
    count: 200,
    speedMin: 0.12,
    speedMax: 0.28,
    sizeMin: 0.005,
    sizeMax: 0.016,
    sway: 0.025,
    swaySpeed: 0.8,
  },
  leaves: {
    base: 'falling',
    shape: 'leaf',
    colors: ['#c1440e', '#e07a1f', '#d9a531', '#8a5a2b', '#a8341f'],
    opacity: 0.92,
    count: 28,
    speedMin: 0.06,
    speedMax: 0.14,
    sizeMin: 0.018,
    sizeMax: 0.04,
    sway: 0.06,
    swaySpeed: 1.2,
    spinMin: 1.2,
    spinMax: 3,
  },
  sakura: {
    base: 'falling',
    shape: 'petal',
    colors: ['#ffd6e8', '#ffc0d9', '#ffb3cf', '#ffffff'],
    opacity: 0.9,
    count: 40,
    speedMin: 0.05,
    speedMax: 0.12,
    sizeMin: 0.012,
    sizeMax: 0.026,
    sway: 0.07,
    swaySpeed: 1,
    spinMin: 0.8,
    spinMax: 2,
  },
  confetti: {
    base: 'falling',
    shape: 'rect',
    colors: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ffffff'],
    opacity: 0.95,
    count: 80,
    speedMin: 0.25,
    speedMax: 0.5,
    sizeMin: 0.01,
    sizeMax: 0.02,
    sway: 0.04,
    swaySpeed: 2,
    spinMin: 2,
    spinMax: 5,
  },
  bokeh: {
    base: 'dots',
    colors: ['#cfe8ff', '#bcd8ff', '#ffffff'],
    opacity: 0.5,
    count: 26,
    speedMin: 0.02,
    speedMax: 0.06,
    sizeMin: 0.02,
    sizeMax: 0.07,
    sway: 0.02,
    swaySpeed: 0.3,
    twinkle: 0.8,
    glow: true,
    dir: -1,
  },
  bokehWarm: {
    base: 'dots',
    colors: ['#ffd9a0', '#ffc371', '#ffe9c7'],
    opacity: 0.5,
    count: 26,
    speedMin: 0.02,
    speedMax: 0.06,
    sizeMin: 0.02,
    sizeMax: 0.07,
    sway: 0.02,
    swaySpeed: 0.3,
    twinkle: 0.8,
    glow: true,
    dir: -1,
  },
  sparkle: {
    base: 'dots',
    colors: ['#ffffff', '#fff4c2'],
    opacity: 0.95,
    count: 70,
    speedMin: 0.005,
    speedMax: 0.03,
    sizeMin: 0.003,
    sizeMax: 0.01,
    sway: 0.01,
    swaySpeed: 0.5,
    twinkle: 6,
    glow: true,
  },
  embers: {
    base: 'dots',
    colors: ['#ff7b29', '#ff5722', '#ffb347', '#ffd56b'],
    opacity: 0.85,
    count: 60,
    speedMin: 0.08,
    speedMax: 0.18,
    sizeMin: 0.004,
    sizeMax: 0.012,
    sway: 0.03,
    swaySpeed: 1.5,
    twinkle: 4,
    glow: true,
    dir: -1,
  },
  fireflies: {
    base: 'dots',
    colors: ['#d8ff7a', '#bdf36a', '#e9ff9e'],
    opacity: 0.9,
    count: 26,
    speedMin: 0.01,
    speedMax: 0.04,
    sizeMin: 0.006,
    sizeMax: 0.014,
    sway: 0.08,
    swaySpeed: 0.8,
    twinkle: 2.5,
    glow: true,
    dir: -1,
  },
  dust: {
    base: 'dots',
    colors: ['#ffffff', '#fff7e6'],
    opacity: 0.35,
    count: 90,
    speedMin: 0.01,
    speedMax: 0.03,
    sizeMin: 0.002,
    sizeMax: 0.006,
    sway: 0.04,
    swaySpeed: 0.4,
  },
}

// Order shown in the dropdown. `none` first, then grouped by family.
export const OVERLAY_OPTIONS = [
  'none',
  'rainLight',
  'rainHeavy',
  'snowGentle',
  'snowHeavy',
  'leaves',
  'sakura',
  'confetti',
  'bokeh',
  'bokehWarm',
  'sparkle',
  'embers',
  'fireflies',
  'dust',
].map(value => ({ value, labelKey: `overlay.opt.${value}` }))

export const isOverlayActive = key => !!key && key !== 'none' && !!OVERLAY_PRESETS[key]

// Paint the active overlay over the current frame. `intensity` scales particle
// count (the rest of the look stays preset-defined). No-op when no overlay is set.
export function drawOverlay(ctx, w, h, t, style) {
  const key = style?.overlay
  if (!isOverlayActive(key)) {
    return
  }
  const p = OVERLAY_PRESETS[key]
  const intensity = style.overlayIntensity != null ? style.overlayIntensity : 1
  const count = Math.max(1, Math.round(p.count * intensity))

  ctx.save()
  if (p.base === 'rain') {
    drawRain(ctx, w, h, t, p, count)
  } else if (p.base === 'falling') {
    drawFalling(ctx, w, h, t, p, count)
  } else {
    drawDots(ctx, w, h, t, p, count)
  }
  ctx.restore()
}
