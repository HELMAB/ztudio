import { GREEN, buildFontStack } from './config'
import { applyKeyframes, imageFramingAt } from './keyframes'
import { activeWordIndex, cueAt } from './srt'
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
  // Centre text manually (measure + offset) rather than textAlign='center',
  // which older iOS/WebKit ignores — see drawCaption.
  ctx.textAlign = 'left'
  const centerText = (s, cx, cy) => ctx.fillText(s, cx - ctx.measureText(s).width / 2, cy)

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
  ctx.font = `800 ${Math.round(badge * 0.62)}px 'Google Sans', system-ui, sans-serif`
  centerText('z', w / 2, by + badge * 0.54)

  // Wordmark below the badge.
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = `700 ${Math.round(u * 0.052)}px 'Google Sans', system-ui, sans-serif`
  centerText('ztudio', w / 2, by + badge + u * 0.04)

  ctx.restore()
}

// Paint the frame background behind the image clips. 'green' keeps the chroma
// key; 'color'/'gradient' use the bgColor controls; 'blur' fills with a blurred,
// darkened cover-crop of the current image so portrait clips get soft bars
// instead of flat fill. Falls back to a solid colour when blur has no image.
function drawBackground(ctx, w, h, current, style) {
  const mode = style.bgMode || 'green'

  if (mode === 'blur' && current && current.bitmap) {
    const bmp = current.bitmap
    const scale = Math.max(w / bmp.width, h / bmp.height) * 1.1
    const dw = bmp.width * scale
    const dh = bmp.height * scale
    ctx.save()
    ctx.filter = 'blur(28px) brightness(0.7)'
    ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh)
    ctx.restore()
    return
  }

  if (mode === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, style.bgColor || '#101014')
    g.addColorStop(1, style.bgColor2 || '#26263a')
    ctx.fillStyle = g
  } else if (mode === 'color') {
    ctx.fillStyle = style.bgColor || '#101014'
  } else if (mode === 'black') {
    ctx.fillStyle = '#000000'
  } else if (mode === 'white') {
    ctx.fillStyle = '#ffffff'
  } else {
    ctx.fillStyle = GREEN
  }
  ctx.fillRect(0, 0, w, h)
}

// Per-clip opacity from its own fade-in / fade-out windows (seconds), 1 when the
// clip has no fades or t sits in its steady middle.
function clipFade(clip, t) {
  let a = 1
  const fi = clip.fadeIn || 0
  const fo = clip.fadeOut || 0
  if (fi > 0 && t < clip.start + fi) {
    a = Math.min(a, clamp01((t - clip.start) / fi))
  }
  if (fo > 0 && t > clip.end - fo) {
    a = Math.min(a, clamp01((clip.end - t) / fo))
  }
  return a
}

// A standalone, time-ranged title drawn over the scene (independent of captions).
// Centred on (x, y) as fractions of the frame; manual line centring matches
// drawCaption's iOS-safe approach. Resolves the title's own font selection.
function drawTextOverlay(ctx, w, h, item) {
  const text = (item.text || '').trim()
  if (!text) {
    return
  }
  const lines = text.split('\n')
  const fontPx = Math.round(h * (item.fontSizePct || 0.05))
  const lineH = fontPx * 1.25
  const cx = w * (item.x ?? 0.5)
  const cy = h * (item.y ?? 0.5)
  const blockH = lines.length * lineH
  const first = cy - blockH / 2 + lineH / 2

  ctx.save()
  ctx.font = `${item.bold ? 700 : 400} ${fontPx}px ${buildFontStack(item.fontKey)}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const sw = fontPx * (item.strokePct || 0)
  ctx.lineWidth = sw
  for (let i = 0; i < lines.length; i++) {
    const y = first + i * lineH
    const x = cx - ctx.measureText(lines[i]).width / 2
    if (sw > 0.5) {
      ctx.strokeStyle = item.strokeColor || '#000000'
      ctx.strokeText(lines[i], x, y)
    }
    ctx.fillStyle = item.color || '#ffffff'
    ctx.fillText(lines[i], x, y)
  }
  ctx.restore()
}

function drawTextOverlays(ctx, w, h, t, texts) {
  if (!texts || !texts.length) {
    return
  }
  for (const item of texts) {
    if (t >= item.start && t < item.end) {
      drawTextOverlay(ctx, w, h, item)
    }
  }
}

// Watermark/logo pinned to a corner, visible only within its [start, end) window
// (end === 0 means the whole video). Sized as a fraction of the frame width with
// a margin off the shorter edge so it sits the same across formats.
function drawLogo(ctx, w, h, t, logo) {
  if (!logo || !logo.bitmap) {
    return
  }
  const start = logo.start || 0
  const end = logo.end || 0
  if (t < start || (end > start && t >= end)) {
    return
  }
  const bmp = logo.bitmap
  const scale = (w * (logo.scalePct || 0.18)) / bmp.width
  const lw = bmp.width * scale
  const lh = bmp.height * scale
  const m = Math.min(w, h) * (logo.marginPct ?? 0.04)
  const pos = logo.position || 'topRight'
  const x = pos.includes('Right') ? w - lw - m : m
  const y = pos.startsWith('bottom') ? h - lh - m : m
  ctx.save()
  ctx.globalAlpha = clamp01(logo.opacity ?? 0.9)
  ctx.drawImage(bmp, x, y, lw, lh)
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

// Draw caption lines word-by-word, emphasising the currently-spoken word
// (karaoke highlight). Each line is laid out centred by measuring its words, then
// the active word is either recoloured ('text' mode) or given a filled pill
// behind it ('fill' mode). `highlight` is { index, color, mode }; word indices run
// in reading order across all lines so they match activeWordIndex.
function drawHighlightedLines(ctx, lines, geom, style, highlight) {
  const { fontPx, lineH, first, w, sw } = geom
  const spaceW = ctx.measureText(' ').width
  let wordIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const y = first + i * lineH
    const words = lines[i] ? lines[i].split(/\s+/).filter(Boolean) : []
    const widths = words.map(word => ctx.measureText(word).width)
    const lineW = widths.reduce((a, b) => a + b, 0) + spaceW * Math.max(0, words.length - 1)
    let x = w / 2 - lineW / 2
    for (let j = 0; j < words.length; j++) {
      const ww = widths[j]
      const active = wordIdx === highlight.index

      if (active && highlight.mode === 'fill') {
        const padX = fontPx * 0.18
        const pillH = fontPx * 1.18
        const r = pillH * 0.22
        ctx.save()
        ctx.fillStyle = highlight.color
        roundRectPath(ctx, x - padX, y - pillH / 2, ww + 2 * padX, pillH, r)
        ctx.fill()
        ctx.restore()
      }

      if (sw > 0.5) {
        ctx.strokeStyle = style.strokeColor
        ctx.strokeText(words[j], x, y)
      }
      ctx.fillStyle = active && highlight.mode === 'text' ? highlight.color : style.fill
      ctx.fillText(words[j], x, y)

      x += ww + spaceW
      wordIdx++
    }
  }
}

function drawCaption(ctx, w, h, text, style, anim, highlight) {
  if (!text) {
    return
  }

  const lines = text.split('\n')
  const { fontPx, lineH, blockH, first } = captionLayout(w, h, lines, style)
  ctx.font = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`
  // Centre each line manually (measure + offset) instead of relying on
  // textAlign='center': older iOS/WebKit ignores it and renders as 'left',
  // pushing the caption off-centre. textAlign='left' is honoured everywhere.
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  // Karaoke highlight shows the full caption (so the reveal animations don't fight
  // it) and colours the spoken word itself; block transforms still apply.
  const isReveal = !highlight && anim && (anim.type === 'typewriter' || anim.type === 'wordByWord')
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

  if (highlight) {
    drawHighlightedLines(ctx, displayLines, { fontPx, lineH, first, w, sw }, style, highlight)
  } else {
    for (let i = 0; i < displayLines.length; i++) {
      const y = first + i * lineH
      const x = w / 2 - ctx.measureText(displayLines[i]).width / 2
      if (sw > 0.5) {
        ctx.strokeStyle = style.strokeColor
        ctx.strokeText(displayLines[i], x, y)
      }
      ctx.fillStyle = style.fill
      ctx.fillText(displayLines[i], x, y)
    }
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

// Draw one slideshow clip at time t with the given opacity. Resolves the clip's
// framing (keyframed or static), crop, fit and per-clip effect — the same path for
// preview and encode. alpha < 1 is used to crossfade clips. save/restore isolates
// globalAlpha and the filter so the caption drawn afterwards stays clean.
function drawImageClip(ctx, w, h, img, keyframes, t, alpha) {
  const bmp = img.bitmap
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
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.filter = effectFilter(img.effect)
  ctx.drawImage(bmp, sx, sy, sw, sh, (w - dw) / 2 + ox, (h - dh) / 2 + oy, dw, dh)
  ctx.restore()
}

export function drawFrame(ctx, w, h, t, { images, cues, style, keyframes, texts, logo }) {
  // Resolve any keyframe animation for this timestamp; static when there are none.
  style = applyKeyframes(style, keyframes, t)

  // The slideshow clip active at this moment, with its own framing; gaps fall back
  // to the chosen background. Resolved before the fill so 'blur' can use it.
  const current = imageAt(t, images)
  drawBackground(ctx, w, h, current, style)

  // Clip transition: during an incoming clip's opening window, blend it with the
  // adjacent clip that was on screen just before it (not a gap, to avoid flashes).
  // Per-clip fade-in/out modulate every clip's opacity on top of the transition.
  const trans = style.transition && style.transition !== 'none' ? style.transition : null
  const tdur = trans ? style.transitionDuration || 0 : 0
  let prev = null
  let p = 1
  if (current && tdur > 0 && t < current.start + tdur) {
    const cand = imageAt(current.start - 1e-4, images)
    if (cand && cand !== current) {
      prev = cand
      p = clamp01((t - current.start) / tdur)
    }
  }

  if (current) {
    const fadeCur = clipFade(current, t)
    if (prev) {
      const pt = Math.min(t, prev.end - 1e-4)
      if (trans === 'dipBlack' || trans === 'dipWhite') {
        // Previous clip is already cut away; incoming rises from a solid colour.
        ctx.save()
        ctx.fillStyle = trans === 'dipBlack' ? '#000000' : '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.restore()
        drawImageClip(ctx, w, h, current, keyframes, t, p * fadeCur)
      } else if (trans === 'slideLeft' || trans === 'slideRight') {
        drawImageClip(ctx, w, h, prev, keyframes, pt, clipFade(prev, pt))
        const dx = (trans === 'slideLeft' ? 1 : -1) * (1 - p) * w
        ctx.save()
        ctx.translate(dx, 0)
        drawImageClip(ctx, w, h, current, keyframes, t, fadeCur)
        ctx.restore()
      } else {
        // crossfade: outgoing frozen underneath, incoming dissolves in.
        drawImageClip(ctx, w, h, prev, keyframes, pt, clipFade(prev, pt))
        drawImageClip(ctx, w, h, current, keyframes, t, p * fadeCur)
      }
    } else {
      drawImageClip(ctx, w, h, current, keyframes, t, fadeCur)
    }
  } else if (!images || !images.length) {
    drawPlaceholder(ctx, w, h)
  }

  // Ambiance particles paint over the background/image but under the caption, so
  // text stays crisp on top. Deterministic in t, so preview and encode match.
  drawOverlay(ctx, w, h, t, style)

  const cue = cueAt(t, cues)
  // Karaoke highlight: which word is spoken right now, plus its colour/style.
  let highlight = null
  if (cue && style.highlightWord) {
    const index = activeWordIndex(t, cue)
    if (index >= 0) {
      highlight = { index, color: style.highlightColor, mode: style.highlightStyle }
    }
  }
  drawCaption(ctx, w, h, cue ? cue.text : '', style, captionAnim(t, cue, style), highlight)

  // Title overlays sit above captions; the watermark/logo is always top-most.
  drawTextOverlays(ctx, w, h, t, texts)
  drawLogo(ctx, w, h, t, logo)
}
