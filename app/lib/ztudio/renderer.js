import { GREEN } from './config'
import { applyKeyframes, imageFramingAt } from './keyframes'
import { cueAt } from './srt'
import { clipCrop, effectFilter, imageAt } from './images'
import { drawOverlay } from './overlays'

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x)

// Reveal types progressively uncover text; return one entry per original line
// (later lines may be empty) so the block keeps a stable height.
function revealLines(lines, type, reveal) {
  if (type === 'typewriter') {
    let budget = Math.ceil(reveal * lines.join('').length)
    return lines.map(line => {
      if (budget <= 0) {
        return ''
      }
      const shown = line.slice(0, budget)
      budget -= line.length
      return shown
    })
  }
  if (type === 'wordByWord') {
    const total = lines.reduce((n, l) => n + (l.trim() ? l.trim().split(/\s+/).length : 0), 0)
    let budget = Math.ceil(reveal * total)
    return lines.map(line => {
      const words = line.trim() ? line.trim().split(/\s+/) : []
      if (budget <= 0) {
        return ''
      }
      const shown = words.slice(0, budget).join(' ')
      budget -= words.length
      return shown
    })
  }
  return lines
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Branded stand-in shown only when no image is loaded: the ztudio "z" badge over
// a "ztudio" wordmark, sized off the shorter edge so it scales across formats. A
// white badge keeps the green mark readable against the chroma background.
function drawPlaceholder(ctx, w, h) {
  const u = Math.min(w, h)
  const badge = u * 0.16
  const bx = (w - badge) / 2
  const by = h / 2 - u * 0.13

  ctx.save()
  ctx.textAlign = 'center'

  // White rounded badge with a soft shadow so the mark floats on the green.
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = badge * 0.14
  ctx.shadowOffsetY = badge * 0.04
  roundRectPath(ctx, bx, by, badge, badge, badge * 0.26)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Brand-green "z", echoing the app logo.
  ctx.fillStyle = '#0c9b50'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${Math.round(badge * 0.62)}px 'Baloo 2', system-ui, sans-serif`
  ctx.fillText('z', w / 2, by + badge * 0.54)

  // Wordmark below the badge.
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = `700 ${Math.round(u * 0.052)}px 'Baloo 2', system-ui, sans-serif`
  ctx.fillText('ztudio', w / 2, by + badge + u * 0.04)

  ctx.restore()
}

// Block geometry for the caption, BEFORE the user reposition offset is applied
// (the offset is applied via a canvas translate in drawCaption).
function captionLayout(w, h, lines, style) {
  const fontPx = Math.round(h * style.fontSizePct)
  const lineH = fontPx * style.lineHeight
  const blockH = lines.length * lineH
  const topM = h * style.topMarginPct
  const botM = h * style.bottomMarginPct

  let first
  if (style.position === 'top') {
    first = topM + lineH / 2
  } else if (style.position === 'center') {
    first = h / 2 - blockH / 2 + lineH / 2
  } else {
    first = h - botM - blockH + lineH / 2
  }
  return { fontPx, lineH, blockH, first }
}

// Centre point of the rendered caption block (offset included), or null when
// there is no text. Used by the preview to draw alignment guides.
export function captionCenter(w, h, text, style) {
  if (!text) {
    return null
  }
  const lines = text.split('\n')
  const { lineH, blockH, first } = captionLayout(w, h, lines, style)
  return {
    cx: w / 2 + w * (style.offsetXPct || 0),
    cy: first - lineH / 2 + blockH / 2 + h * (style.offsetYPct || 0),
    blockH,
  }
}

function drawCaption(ctx, w, h, text, style, anim) {
  if (!text) {
    return
  }

  const lines = text.split('\n')
  const { fontPx, lineH, blockH, first } = captionLayout(w, h, lines, style)
  ctx.font = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  const isReveal = anim && (anim.type === 'typewriter' || anim.type === 'wordByWord')
  const displayLines = isReveal ? revealLines(lines, anim.type, anim.reveal) : lines

  ctx.save()

  // User repositioning: shift the whole block (box, stroke, fill, and the
  // animation pivot move together) by a fraction of the frame size.
  ctx.translate(w * (style.offsetXPct || 0), h * (style.offsetYPct || 0))

  // Transform/opacity effects pivot around the caption block centre.
  if (anim && !isReveal) {
    const e = anim.enter
    const cx = w / 2
    const cy = first - lineH / 2 + blockH / 2
    let dx = 0
    let dy = 0
    let scale = 1
    const dist = h * 0.05
    const distX = w * 0.08

    if (anim.type === 'slideUp') {
      dy = (1 - e) * dist
    } else if (anim.type === 'slideDown') {
      dy = -(1 - e) * dist
    } else if (anim.type === 'slideLeft') {
      dx = (1 - e) * distX
    } else if (anim.type === 'slideRight') {
      dx = -(1 - e) * distX
    } else if (anim.type === 'pop') {
      scale = 0.6 + 0.4 * e
    } else if (anim.type === 'zoom') {
      scale = 1.5 - 0.5 * e
    } else if (anim.type === 'blur') {
      ctx.filter = `blur(${(1 - e) * 10}px)`
    }

    ctx.globalAlpha = e
    ctx.translate(cx + dx, cy + dy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
  }

  if (style.box) {
    let maxW = 0
    for (const line of lines) {
      maxW = Math.max(maxW, ctx.measureText(line).width)
    }
    const padX = fontPx * 0.45
    const padY = fontPx * 0.28
    const bw = maxW + 2 * padX
    const bh = blockH + 2 * padY
    ctx.fillStyle = style.boxColor
    ctx.fillRect(w / 2 - bw / 2, first - lineH / 2 - padY, bw, bh)
  }

  const sw = fontPx * style.strokePct
  ctx.lineWidth = sw

  for (let i = 0; i < displayLines.length; i++) {
    const y = first + i * lineH
    if (sw > 0.5) {
      ctx.strokeStyle = style.strokeColor
      ctx.strokeText(displayLines[i], w / 2, y)
    }
    ctx.fillStyle = style.fill
    ctx.fillText(displayLines[i], w / 2, y)
  }

  ctx.restore()
}

// Animation progress for the cue active at time t, or null when there is none.
function captionAnim(t, cue, style) {
  if (!cue || !style.animation || style.animation === 'none') {
    return null
  }
  const d = style.animDuration || 0
  if (d <= 0) {
    return null
  }
  const inP = clamp01((t - cue.start) / d)
  const outP = clamp01((cue.end - t) / d)
  return { type: style.animation, enter: Math.min(inP, outP), reveal: inP }
}

export function drawFrame(ctx, w, h, t, { images, cues, style, keyframes }) {
  // Resolve any keyframe animation for this timestamp; static when there are none.
  style = applyKeyframes(style, keyframes, t)

  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, w, h)

  // The slideshow clip active at this moment, with its own framing; gaps stay green.
  const img = imageAt(t, images)
  if (img) {
    const bmp = img.bitmap
    // Zoom/pan are keyframe-animated when the clip has keyframes in its span,
    // otherwise the clip's static framing is used (imageFramingAt handles both).
    const frame = imageFramingAt(img, keyframes, t)
    // Source-crop rect (normalized 0..1). Fit/zoom/pan operate on the cropped region.
    const c = clipCrop(img)
    const sx = c ? c.x * bmp.width : 0
    const sy = c ? c.y * bmp.height : 0
    const sw = c ? c.w * bmp.width : bmp.width
    const sh = c ? c.h * bmp.height : bmp.height
    const base = img.fit === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh)
    // Per-clip zoom (multiplies the fit scale) and pan (fraction of frame size).
    const scale = base * (frame.zoom || 1)
    const dw = sw * scale
    const dh = sh * scale
    const ox = w * (frame.offsetXPct || 0)
    const oy = h * (frame.offsetYPct || 0)
    // Effect applies to the image draw only; reset to 'none' so the caption is clean.
    ctx.filter = effectFilter(img.effect)
    ctx.drawImage(bmp, sx, sy, sw, sh, (w - dw) / 2 + ox, (h - dh) / 2 + oy, dw, dh)
    ctx.filter = 'none'
  } else if (!images || !images.length) {
    drawPlaceholder(ctx, w, h)
  }

  // Ambiance particles paint over the background/image but under the caption, so
  // text stays crisp on top. Deterministic in t, so preview and encode match.
  drawOverlay(ctx, w, h, t, style)

  const cue = cueAt(t, cues)
  drawCaption(ctx, w, h, cue ? cue.text : '', style, captionAnim(t, cue, style))
}
