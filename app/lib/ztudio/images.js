import { IMAGE_EFFECTS } from './config'

// Resolve a clip's effect key to a canvas `ctx.filter` string ('none' when absent).
export function effectFilter(effect) {
  if (!effect || effect === 'none') {
    return 'none'
  }
  const entry = IMAGE_EFFECTS.find(e => e.value === effect)
  return entry ? entry.filter : 'none'
}

// The image track is a sequential slideshow: at most one clip is active at any
// time. Clips are kept sorted by start; the active one is the last whose range
// contains t. Returns null in gaps (the frame falls back to the green key).
export function imageAt(t, images) {
  if (!images || !images.length) {
    return null
  }
  let active = null
  for (const img of images) {
    if (t >= img.start && t < img.end) {
      active = img
    }
  }
  return active
}

// Where a clip lands on a w×h frame: centre point, drawn size, and rotation
// (degrees). `frame` is the resolved framing ({zoom, offsetXPct, offsetYPct},
// static or keyframed). Shared by the renderer and the preview's selection
// handles so the on-canvas gizmo always matches the drawn pixels.
export function imageDrawRect(w, h, img, frame) {
  const c = clipCrop(img)
  const sw = (c ? c.w : 1) * img.width
  const sh = (c ? c.h : 1) * img.height
  const base = img.fit === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh)
  const scale = base * (frame.zoom || 1)
  return {
    cx: w / 2 + w * (frame.offsetXPct || 0),
    cy: h / 2 + h * (frame.offsetYPct || 0),
    dw: sw * scale,
    dh: sh * scale,
    rotation: img.rotation || 0,
  }
}

// Normalized source-crop rect for a clip, or null when it is uncropped.
export function clipCrop(img) {
  const tp = img.cropTop || 0
  const bt = img.cropBottom || 0
  const lf = img.cropLeft || 0
  const rt = img.cropRight || 0
  if (!tp && !bt && !lf && !rt) {
    return null
  }
  return { x: lf, y: tp, w: Math.max(0.05, 1 - lf - rt), h: Math.max(0.05, 1 - tp - bt) }
}
