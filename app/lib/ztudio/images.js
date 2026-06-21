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
