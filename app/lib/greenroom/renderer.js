import { GREEN } from './config'
import { captionAt } from './srt'

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

function drawCaption(ctx, w, h, text, style) {
  if (!text) {
    return
  }

  const fontPx = Math.round(h * style.fontSizePct)
  ctx.font = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  const lines = text.split('\n')
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

  for (let i = 0; i < lines.length; i++) {
    const y = first + i * lineH
    if (sw > 0.5) {
      ctx.strokeStyle = style.strokeColor
      ctx.strokeText(lines[i], w / 2, y)
    }
    ctx.fillStyle = style.fill
    ctx.fillText(lines[i], w / 2, y)
  }
}

export function drawFrame(ctx, w, h, t, { imageBitmap, imageFit, cues, style }) {
  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, w, h)

  if (imageBitmap) {
    const scale = imageFit === 'cover'
      ? Math.max(w / imageBitmap.width, h / imageBitmap.height)
      : Math.min(w / imageBitmap.width, h / imageBitmap.height)
    const dw = imageBitmap.width * scale
    const dh = imageBitmap.height * scale
    ctx.drawImage(imageBitmap, (w - dw) / 2, (h - dh) / 2, dw, dh)
  } else {
    drawPlaceholder(ctx, w, h)
  }

  drawCaption(ctx, w, h, captionAt(t, cues), style)
}
