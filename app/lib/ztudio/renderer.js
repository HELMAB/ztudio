import { GREEN } from './config'
import { cueAt } from './srt'

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

function drawPlaceholder(ctx, w, h) {
  const cw = Math.min(w, h) * 0.6
  const ch = cw * 0.66
  const cx = (w - cw) / 2
  const cy = (h - ch) / 2

  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(cx, cy, cw, ch)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = `700 ${Math.round(cw * 0.09)}px system-ui,sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('IMAGE', w / 2, h / 2)
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

export function drawFrame(ctx, w, h, t, { imageBitmap, imageFit, cues, style }) {
  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, w, h)

  if (imageBitmap) {
    const scale =
      imageFit === 'cover'
        ? Math.max(w / imageBitmap.width, h / imageBitmap.height)
        : Math.min(w / imageBitmap.width, h / imageBitmap.height)
    const dw = imageBitmap.width * scale
    const dh = imageBitmap.height * scale
    ctx.drawImage(imageBitmap, (w - dw) / 2, (h - dh) / 2, dw, dh)
  } else {
    drawPlaceholder(ctx, w, h)
  }

  const cue = cueAt(t, cues)
  drawCaption(ctx, w, h, cue ? cue.text : '', style, captionAnim(t, cue, style))
}
