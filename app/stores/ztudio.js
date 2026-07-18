import { defineStore } from 'pinia'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import {
  DEFAULT_STYLE,
  EXPORT_DEFAULTS,
  KHMER_FONT,
  LOGO_DEFAULTS,
  MAX_AUDIO_SEC,
  PRESETS,
  QUALITY_OPTIONS,
  buildFontStack,
} from '@/lib/ztudio/config'
import { AUDIO_DEFAULTS, renderMix } from '@/lib/ztudio/audio'
import { KHMER_FONTS } from '@/lib/ztudio/khmer-fonts'
import { captionAt, parseSRT } from '@/lib/ztudio/srt'
import { imageAt } from '@/lib/ztudio/images'
import { drawFrame } from '@/lib/ztudio/renderer'
import {
  CAPTION_FIELDS,
  DEFAULT_EASING,
  imageFramingAt,
  keyframeValues,
} from '@/lib/ztudio/keyframes'
import {
  decodeAudioFile,
  generateFast,
  generateRealtime,
  loadMediabunny,
  mrType,
  pickPipeline,
} from '@/lib/ztudio/encoder'
import {
  clearFonts as idbClearFonts,
  getAllFonts as idbGetAllFonts,
  putFont as idbPutFont,
} from '@/lib/ztudio/font-store'
import {
  allBlobKeys,
  clearProject as idbClearProject,
  deleteBlob,
  getBlob,
  loadDoc,
  putBlob,
  saveDoc,
} from '@/lib/ztudio/project-store'
import { useActivityLog } from '@/composables/useActivityLog'

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Decode an image blob to an ImageBitmap. Raster formats decode directly; SVG
// goes through an <img> + canvas because createImageBitmap on an SVG blob is
// unreliable across browsers — so logos can be PNG/JPG or SVG.
async function bitmapFromBlob(blob) {
  if (blob.type !== 'image/svg+xml') {
    return createImageBitmap(blob)
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = url
    })
    const w = img.naturalWidth || 512
    const h = img.naturalHeight || 512
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    cv.getContext('2d').drawImage(img, 0, 0, w, h)
    return await createImageBitmap(cv)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const useZtudioStore = defineStore('ztudio', () => {
  const { entries: logEntries, log } = useActivityLog()

  const audioBuffer = ref(null)
  // Optional background-music bed mixed under the voice (see `audio` controls and
  // renderMix). Held decoded like audioBuffer; not part of undo history.
  const musicBuffer = ref(null)
  const musicName = ref('')
  // Audio mixing controls: voice level + fades, music level + fades + loop, and
  // auto-ducking (music dips while the voice talks). Drives both preview and export.
  const audio = reactive({ ...AUDIO_DEFAULTS })
  // The image track: a sorted array of slideshow clips, each with its own time
  // range and framing. Replaces the former single image.
  const images = ref([])
  const selectedImageId = ref(null)
  const cues = ref([])
  // Audio trim window in seconds (absolute media time). trimEnd 0 == full clip.
  const trimStart = ref(0)
  const trimEnd = ref(0)
  const srtSpan = computed(() => (cues.value.length ? Math.max(...cues.value.map(c => c.end)) : 0))

  const resolution = ref('1080x1920')
  const customFonts = ref([])
  const preset = ref('clean')
  const scrub = ref(0)
  const previewTick = ref(0)
  // Timeline zoom lives here (not in the Timeline component) so keyboard shortcuts
  // and the zoom buttons drive the same state. 1 fits the duration to the viewport.
  const timelineZoom = ref(1)
  // Timeline snapping: when on, dragged playhead/trim/keyframe/clip edges snap to
  // nearby cue boundaries, clip edges, the playhead, and the timeline ends.
  // `snapGuide` is the time (seconds) of the active snap line during a drag, or
  // null — components set it via the snap helpers and clear it on drop.
  const snapEnabled = ref(true)
  const snapGuide = ref(null)
  // Keyboard-shortcuts help overlay visibility (toggled by '?' and the TopBar).
  const showShortcuts = ref(false)
  // Export settings dialog: the user picks quality/format/fps here before the
  // render kicks off (opened by the TopBar Export button).
  const exportDialog = ref(false)
  // Which Inspector tab is shown. Selection drives it: clicking a clip on the
  // timeline (or the preview) opens that object's properties — see the select*
  // actions below. Values match the InspectorPanel tab triggers.
  const inspectorTab = ref('style')
  // Right-click context menu: position + the items (each { label, action?,
  // danger?, separator? }) built by whichever component was right-clicked.
  const contextMenu = ref({ open: false, x: 0, y: 0, items: [] })
  const selectedCueIndex = ref(null)
  // Add/edit caption dialog: { open, mode: 'add' | 'edit', index }.
  const captionDialog = ref({ open: false, mode: 'add', index: null })

  const controls = reactive({
    fontKey: 'AKbalthom Freedom',
    fontSizePct: 0.03,
    fontWeight: '700',
    fill: '#ffffff',
    strokeColor: '#000000',
    strokePct: 0.16,
    lineHeight: 1.34,
    highlightWord: true,
    highlightColor: '#00e0a4',
    highlightStyle: 'text',
    position: 'bottom',
    offsetXPct: 0,
    offsetYPct: 0,
    box: false,
    animation: 'blur',
    overlay: 'leaves',
    overlayIntensity: 1,
    transition: 'none',
    transitionDuration: 0.5,
    bgMode: 'green',
    bgColor: '#101014',
    bgColor2: '#26263a',
  })

  // Export settings (bitrate/container/fps) — separate from the caption style and
  // kept out of undo history, but persisted with the project.
  const exportSettings = reactive({ ...EXPORT_DEFAULTS })

  // Standalone title-text overlays (timed, positioned independently of captions).
  const texts = ref([])
  const selectedTextId = ref(null)
  let textCounter = 0

  // Persistent watermark/logo: a decoded bitmap plus its framing controls. Held
  // like the music bed — media-like, so it's excluded from undo history.
  const logoBitmap = ref(null)
  const logoName = ref('')
  let rawLogo = null
  const logo = reactive({ ...LOGO_DEFAULTS })

  // What canvas-drag on the preview repositions: 'caption' or 'image'.
  const dragTarget = ref('caption')

  // Keyframes animate caption position and the active clip's framing over time.
  // Each is a snapshot of those fields (see animatedSnapshot) at a time t with an
  // easing for the transition into it. Kept sorted.
  const keyframes = ref([])
  const selectedKeyframeId = ref(null)

  const { $i18n } = useNuxtApp()
  const t = (key, params) => $i18n.t(key, params)

  const busy = ref(false)
  const statusState = ref({ key: 'status.addAudio' })
  const status = computed(() =>
    statusState.value.raw != null
      ? statusState.value.raw
      : t(statusState.value.key, statusState.value.params || {}),
  )
  function setStatus(key, params) {
    statusState.value = { key, params }
  }
  function setStatusRaw(raw) {
    statusState.value = { raw }
  }
  const progress = ref(0)
  const showProgress = ref(false)
  const result = ref(null)
  const envState = ref({ level: 'pending', titleKey: 'env.checking' })
  const env = computed(() => ({
    level: envState.value.level,
    title: t(envState.value.titleKey, envState.value.titleParams || {}),
    note: envState.value.noteKey ? t(envState.value.noteKey) : '',
  }))
  const isPlaying = ref(false)
  // Loop the active play region (the trim window, or the whole clip when nothing
  // is trimmed): when playback reaches the end it jumps back to the start instead
  // of stopping. Used to review caption timing over and over.
  const loopPlayback = ref(false)
  // Preview-monitor volume (0..1) and mute. These shape only what you hear while
  // previewing — they never touch the exported mix (that's the inspector's
  // voiceGain/musicGain). Applied live during playback via a master gain node.
  const previewVolume = ref(1)
  const muted = ref(false)
  const monitorGain = computed(() => (muted.value ? 0 : previewVolume.value))

  // Desktop workspace layout: side-panel widths, timeline height, and whether the
  // side panels are open. Resizable via drag handles and collapsible from the top
  // bar; persisted to localStorage so the editor remembers your layout.
  const LAYOUT_KEY = 'ztudio_layout'
  const LAYOUT_DEFAULTS = {
    mediaWidth: 288,
    inspectorWidth: 320,
    timelineHeight: 192,
    mediaOpen: true,
    inspectorOpen: true,
  }
  const LAYOUT_LIMITS = {
    mediaWidth: [220, 480],
    inspectorWidth: [260, 560],
    timelineHeight: [120, 520],
  }
  const layout = reactive({ ...LAYOUT_DEFAULTS })

  function loadLayout() {
    if (typeof localStorage === 'undefined') {
      return
    }
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null')
      if (saved && typeof saved === 'object') {
        Object.assign(layout, LAYOUT_DEFAULTS, saved)
      }
    } catch {
      /* ignore malformed/blocked storage */
    }
  }

  function saveLayout() {
    if (typeof localStorage === 'undefined') {
      return
    }
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
    } catch {
      /* storage full/blocked — layout just won't persist */
    }
  }

  // Set a resizable dimension, clamped to its [min, max]. `commit` writes the new
  // size to storage (pass false during a live drag, true on release).
  function setPanelSize(key, value, commit = false) {
    const limit = LAYOUT_LIMITS[key]
    if (!limit) {
      return
    }
    layout[key] = Math.min(Math.max(value, limit[0]), limit[1])
    if (commit) {
      saveLayout()
    }
  }

  function toggleMediaPanel() {
    layout.mediaOpen = !layout.mediaOpen
    saveLayout()
  }

  function toggleInspectorPanel() {
    layout.inspectorOpen = !layout.inspectorOpen
    saveLayout()
  }

  let cancelRequested = false
  let applyingPreset = false
  let loadingKeyframe = false
  // True while an undo/redo snapshot is being applied, so the watchers that
  // would otherwise record history (or re-derive presets/keyframes) stand down.
  let restoring = false
  let kfCounter = 0
  let fontCounter = 0
  let imageCounter = 0
  // Decoded bitmaps kept by clip id for the whole session so undo/redo can
  // restore a removed image clip without re-decoding the file.
  const bitmapRegistry = new Map()
  // Raw encoded media kept for persistence (the decoded AudioBuffer/ImageBitmap
  // can't be re-serialised, so we stash the original bytes to re-decode on resume).
  let rawAudio = null
  let rawMusic = null
  const imageBlobs = new Map() // image clip id -> Blob
  const persistedBlobs = new Map() // IDB key -> the blob currently written, to skip rewrites
  // Autosave: 'idle' until the first save, then 'saving' | 'saved' | 'error'.
  const autosaveStatus = ref('idle')
  // A previously-saved project found on launch, awaiting the user's Resume/Discard.
  const pendingRestore = ref(null)
  // True during init/restore so those bulk changes don't trigger an autosave.
  let initializing = true
  let playRaf = null
  let playCtx = null
  let playSource = null
  let playMusicSource = null
  // Master gain that both voice and music route through during playback, so the
  // preview-monitor volume/mute can be applied (and updated live) in one place.
  let playMasterGain = null
  let playStartClock = 0
  let playStartOffset = 0

  const dimensions = computed(() => {
    const [w, h] = resolution.value.split('x').map(Number)
    return { w, h }
  })
  const previewDuration = computed(() =>
    audioBuffer.value ? audioBuffer.value.duration : Math.max(10, srtSpan.value),
  )
  // Effective trim window; falls back to the full clip when nothing is trimmed.
  const trimWindow = computed(() => {
    if (!audioBuffer.value) {
      return { from: 0, to: previewDuration.value }
    }
    const dur = audioBuffer.value.duration
    const from = Math.max(0, Math.min(trimStart.value, dur))
    const to = trimEnd.value > 0 ? Math.min(trimEnd.value, dur) : dur
    return { from, to: Math.max(from, to) }
  })
  const outputDuration = computed(() => trimWindow.value.to - trimWindow.value.from)
  const hasTrim = computed(
    () =>
      !!audioBuffer.value &&
      (trimWindow.value.from > 0.001 || trimWindow.value.to < audioBuffer.value.duration - 0.001),
  )
  const hasImages = computed(() => images.value.length > 0)
  // The clip being edited in the inspector / dragged on the preview.
  const selectedImage = computed(
    () => images.value.find(im => im.id === selectedImageId.value) || null,
  )
  // The clip on screen at the playhead (gaps → null).
  const activeImage = computed(() => imageAt(scrub.value, images.value))
  const selectedImageHasCrop = computed(() => {
    const im = selectedImage.value
    return !!im && !!(im.cropTop || im.cropBottom || im.cropLeft || im.cropRight)
  })
  const currentCaption = computed(() => captionAt(scrub.value, cues.value))
  const hasKeyframes = computed(() => keyframes.value.length > 0)
  const canRender = computed(() => !!audioBuffer.value && !busy.value)
  const fontOptions = computed(() => [
    { value: 'default', label: 'Noto Sans Khmer' },
    ...KHMER_FONTS.map(f => ({ value: f.family, label: f.label })),
    ...customFonts.value,
  ])
  const progressPercent = computed(() => Math.round(progress.value * 100))
  const sizeLabel = computed(() => (controls.fontSizePct * 100).toFixed(1) + '%')
  const strokeLabel = computed(() => Math.round(controls.strokePct * 100) + '%')
  const lineHeightLabel = computed(() => controls.lineHeight.toFixed(2) + '×')
  const imageZoomLabel = computed(() => Math.round((selectedImage.value?.zoom || 1) * 100) + '%')
  const timeLabel = computed(() => scrub.value.toFixed(1) + 's')
  const outputDurationLabel = computed(() => fmt(outputDuration.value))
  const trimStartLabel = computed(() => fmt(trimWindow.value.from))
  const trimEndLabel = computed(() => fmt(trimWindow.value.to))

  const style = computed(() => ({
    ...DEFAULT_STYLE,
    fontFamily: buildFontStack(controls.fontKey),
    fontSizePct: controls.fontSizePct,
    fontWeight: controls.fontWeight,
    fill: controls.fill,
    strokeColor: controls.strokeColor,
    strokePct: controls.strokePct,
    lineHeight: controls.lineHeight,
    highlightWord: controls.highlightWord,
    highlightColor: controls.highlightColor,
    highlightStyle: controls.highlightStyle,
    position: controls.position,
    offsetXPct: controls.offsetXPct,
    offsetYPct: controls.offsetYPct,
    box: controls.box,
    animation: controls.animation,
    overlay: controls.overlay,
    overlayIntensity: controls.overlayIntensity,
    transition: controls.transition,
    transitionDuration: controls.transitionDuration,
    bgMode: controls.bgMode,
    bgColor: controls.bgColor,
    bgColor2: controls.bgColor2,
  }))

  const selectedText = computed(
    () => texts.value.find(tx => tx.id === selectedTextId.value) || null,
  )
  // The title on screen at the playhead (topmost when several overlap), used to
  // pick a drag target on the preview. Null when none is showing.
  const activeText = computed(() => {
    let found = null
    for (const tx of texts.value) {
      if (scrub.value >= tx.start && scrub.value < tx.end) {
        found = tx
      }
    }
    return found
  })
  const hasTexts = computed(() => texts.value.length > 0)
  const hasLogo = computed(() => !!logoBitmap.value)
  // The resolved logo passed to the renderer (bitmap + framing), or null when none.
  const logoResolved = computed(() =>
    logoBitmap.value ? { bitmap: logoBitmap.value, ...logo } : null,
  )

  const audioPill = computed(() =>
    audioBuffer.value
      ? { ok: true, text: t('pill.audio', { time: fmt(audioBuffer.value.duration) }) }
      : { ok: false, text: t('pill.noAudio') },
  )
  const musicPill = computed(() =>
    musicBuffer.value
      ? { ok: true, text: t('pill.music', { time: fmt(musicBuffer.value.duration) }) }
      : { ok: false, text: t('pill.noMusic') },
  )
  const hasMusic = computed(() => !!musicBuffer.value)
  const imagePill = computed(() =>
    images.value.length
      ? { ok: true, text: t('pill.images', { count: images.value.length }) }
      : { ok: false, text: t('pill.noImage') },
  )
  const srtPill = computed(() =>
    cues.value.length
      ? { ok: true, text: t('pill.cues', { count: cues.value.length }) }
      : { ok: false, text: t('pill.noCaptions') },
  )
  const fontPill = computed(() =>
    customFonts.value.length
      ? { ok: true, text: t('pill.fonts', { count: customFonts.value.length }) }
      : { ok: false, text: t('pill.noFonts') },
  )
  const logoPill = computed(() =>
    logoBitmap.value
      ? { ok: true, text: t('pill.logo', { name: logoName.value }) }
      : { ok: false, text: t('pill.noLogo') },
  )

  function redraw() {
    previewTick.value++
  }

  // ±1 frame so a bottom-anchored caption can be dragged all the way to the top
  // (and vice versa); half a frame isn't enough to clear the position margins.
  const clampOffset = v => (v < -1 ? -1 : v > 1 ? 1 : v)

  // Drag-to-reposition: offsets are fractions of frame width/height.
  function setCaptionOffset(xPct, yPct) {
    controls.offsetXPct = clampOffset(xPct)
    controls.offsetYPct = clampOffset(yPct)
  }

  function resetCaptionOffset() {
    setCaptionOffset(0, 0)
  }

  const clampZoom = v => (v < 0.5 ? 0.5 : v > 4 ? 4 : v)
  const clampPan = v => (v < -1 ? -1 : v > 1 ? 1 : v)
  const clampCrop = v => (v < 0 ? 0 : v > 0.45 ? 0.45 : v)

  // All image-framing edits target the selected clip.
  function setImageZoom(z) {
    const im = selectedImage.value
    if (im) {
      im.zoom = clampZoom(z)
      autoKeyAtPlayhead()
      redraw()
    }
  }

  function setImageOffset(xPct, yPct) {
    const im = selectedImage.value
    if (im) {
      im.offsetXPct = clampPan(xPct)
      im.offsetYPct = clampPan(yPct)
      autoKeyAtPlayhead()
      redraw()
    }
  }

  // Rotation is static per clip (not keyframed); normalized to (-180, 180].
  function setImageRotation(deg) {
    const im = selectedImage.value
    if (im && Number.isFinite(deg)) {
      let d = deg % 360
      if (d > 180) {
        d -= 360
      } else if (d <= -180) {
        d += 360
      }
      im.rotation = Math.round(d * 10) / 10
      redraw()
    }
  }

  function setImageFit(fit) {
    const im = selectedImage.value
    if (im) {
      im.fit = fit
      redraw()
    }
  }

  function setImageEffect(effect) {
    const im = selectedImage.value
    if (im) {
      im.effect = effect
      redraw()
    }
  }

  function setImageCrop(side, value) {
    const im = selectedImage.value
    if (im && ['cropTop', 'cropBottom', 'cropLeft', 'cropRight'].includes(side)) {
      im[side] = clampCrop(value)
      redraw()
    }
  }

  // Per-clip fade in/out (seconds). Clamped so the two fades can't exceed the
  // clip's own length, which would otherwise leave it never fully opaque.
  function setImageFade(side, value) {
    const im = selectedImage.value
    if (!im || (side !== 'fadeIn' && side !== 'fadeOut')) {
      return
    }
    const len = im.end - im.start
    im[side] = Math.max(0, Math.min(value, len))
    redraw()
  }

  function resetImageTransform() {
    const im = selectedImage.value
    if (im) {
      im.zoom = 1
      im.offsetXPct = 0
      im.offsetYPct = 0
      im.rotation = 0
      autoKeyAtPlayhead()
      redraw()
    }
  }

  function resetImageCrop() {
    const im = selectedImage.value
    if (im) {
      im.cropTop = 0
      im.cropBottom = 0
      im.cropLeft = 0
      im.cropRight = 0
      redraw()
    }
  }

  // Set the audio trim window (seconds). Keeps a minimum gap and clamps to the clip.
  function setTrim(start, end) {
    if (!audioBuffer.value) {
      return
    }
    const dur = audioBuffer.value.duration
    const MIN_GAP = 0.1
    let s = Math.max(0, Math.min(start, dur - MIN_GAP))
    let e = Math.min(dur, Math.max(end, s + MIN_GAP))
    trimStart.value = Math.round(s * 1000) / 1000
    trimEnd.value = Math.round(e * 1000) / 1000
    if (scrub.value < trimStart.value || scrub.value > trimEnd.value) {
      scrub.value = trimStart.value
    }
  }

  function resetTrim() {
    trimStart.value = 0
    trimEnd.value = audioBuffer.value ? audioBuffer.value.duration : 0
  }

  function clampScrub() {
    if (scrub.value > previewDuration.value) {
      scrub.value = 0
    }
  }

  function maybeReady() {
    if (audioBuffer.value && !busy.value) {
      setStatus('status.ready')
    }
  }

  function applyPreset(key) {
    const p = PRESETS[key]
    if (!p) {
      return
    }
    applyingPreset = true
    controls.fontSizePct = p.size
    controls.fontWeight = String(p.weight)
    controls.fill = p.fill
    controls.strokeColor = p.stroke
    controls.strokePct = p.strokew
    controls.position = p.pos
    controls.offsetXPct = 0
    controls.offsetYPct = 0
    controls.box = p.box
    redraw()
    nextTick(() => {
      applyingPreset = false
    })
  }

  watch(preset, key => {
    if (restoring) {
      return
    }
    if (key !== 'custom') {
      applyPreset(key)
    }
  })

  // Logo framing is edited directly (v-model on the reactive), so repaint the
  // preview when any of its fields change.
  watch(logo, redraw)

  watch(
    () => [
      controls.fontSizePct,
      controls.fontWeight,
      controls.fill,
      controls.strokeColor,
      controls.strokePct,
      controls.lineHeight,
      controls.highlightWord,
      controls.highlightColor,
      controls.highlightStyle,
      controls.position,
      controls.offsetXPct,
      controls.offsetYPct,
      controls.box,
    ],
    () => {
      if (!applyingPreset && !loadingKeyframe) {
        preset.value = 'custom'
      }
      redraw()
    },
  )

  watch(
    () => controls.fontKey,
    key => ensureBundledFont(key).then(redraw),
  )
  watch(
    () => [
      controls.animation,
      controls.overlay,
      controls.overlayIntensity,
      controls.transition,
      controls.transitionDuration,
      controls.bgMode,
      controls.bgColor,
      controls.bgColor2,
      resolution.value,
    ],
    redraw,
  )

  // A keyframe captures the whole scene at one instant: caption position (global)
  // plus the framing of the clip on screen (zoom/pan, defaulting when in a gap).
  function animatedSnapshot() {
    const im = activeImage.value
    return {
      offsetXPct: controls.offsetXPct,
      offsetYPct: controls.offsetYPct,
      imageZoom: im ? im.zoom : 1,
      imageOffsetXPct: im ? im.offsetXPct : 0,
      imageOffsetYPct: im ? im.offsetYPct : 0,
    }
  }

  // Editing an animated property while keyframes exist commits the change to a
  // keyframe at the current playhead (auto-key). Skipped while syncing from a
  // keyframe so loading a frame's values never spawns a stray keyframe.
  function autoKeyAtPlayhead() {
    if (loadingKeyframe || !keyframes.value.length) {
      return
    }
    upsertKeyframeAt(scrub.value)
  }

  // Caption position auto-keys via its controls (drag / sliders rewrite these).
  // Image framing auto-keys from its edit functions instead of a watcher, so that
  // merely scrubbing across a clip boundary (which swaps the active clip) can never
  // be mistaken for an edit and spawn a stray keyframe.
  watch(() => [controls.offsetXPct, controls.offsetYPct], autoKeyAtPlayhead)

  // Scrubbing mirrors the interpolated values back so the panel, sliders, and
  // drag handles reflect the frame under the playhead: caption offsets into
  // `controls`, and the active clip's framing back onto the clip (only when that
  // clip has keyframes in its span, so static clips are never touched).
  watch(
    () => scrub.value,
    t => {
      if (!keyframes.value.length) {
        return
      }
      loadingKeyframe = true
      Object.assign(controls, keyframeValues(keyframes.value, t, CAPTION_FIELDS))
      const im = imageAt(t, images.value)
      if (im && keyframes.value.some(k => k.t >= im.start && k.t < im.end)) {
        const f = imageFramingAt(im, keyframes.value, t)
        im.zoom = f.zoom
        im.offsetXPct = f.offsetXPct
        im.offsetYPct = f.offsetYPct
      }
      nextTick(() => {
        loadingKeyframe = false
      })
    },
  )

  const KEYFRAME_EPS = 0.04

  function upsertKeyframeAt(t) {
    const existing = keyframes.value.find(k => Math.abs(k.t - t) <= KEYFRAME_EPS)
    const kf = {
      id: existing ? existing.id : ++kfCounter,
      t: existing ? existing.t : +t.toFixed(3),
      easing: existing ? existing.easing : DEFAULT_EASING,
      values: animatedSnapshot(),
    }
    keyframes.value = [...keyframes.value.filter(k => k !== existing), kf].sort((a, b) => a.t - b.t)
    selectedKeyframeId.value = kf.id
    redraw()
  }

  function addKeyframe() {
    upsertKeyframeAt(scrub.value)
  }

  function removeKeyframe(id) {
    keyframes.value = keyframes.value.filter(k => k.id !== id)
    if (selectedKeyframeId.value === id) {
      selectedKeyframeId.value = null
    }
    redraw()
  }

  function clearKeyframes() {
    keyframes.value = []
    selectedKeyframeId.value = null
    redraw()
  }

  function selectKeyframe(id) {
    selectedKeyframeId.value = id
    inspectorTab.value = 'animation'
    const kf = keyframes.value.find(k => k.id === id)
    if (kf) {
      seek(kf.t)
    }
  }

  function setKeyframeEasing(id, easing) {
    keyframes.value = keyframes.value.map(k => (k.id === id ? { ...k, easing } : k))
    redraw()
  }

  function moveKeyframe(id, t) {
    const clamped = Math.max(0, Math.min(previewDuration.value, t))
    keyframes.value = keyframes.value
      .map(k => (k.id === id ? { ...k, t: +clamped.toFixed(3) } : k))
      .sort((a, b) => a.t - b.t)
    redraw()
  }

  // --- Undo / redo -------------------------------------------------------
  // History is snapshot-based: a settled change captures the whole editable
  // document. Media buffers are left out — image clips store metadata only and
  // re-attach their bitmap from the registry on restore.
  const HISTORY_LIMIT = 60
  const past = ref([])
  const future = ref([])
  let present = null
  let historyReady = false
  let historyTimer = null

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function stripBitmap(im) {
    const copy = { ...im }
    delete copy.bitmap
    return copy
  }

  function docSnapshot() {
    return {
      controls: { ...controls },
      audio: { ...audio },
      cues: cues.value.map(c => ({ ...c })),
      keyframes: keyframes.value.map(k => ({ ...k, values: { ...k.values } })),
      images: images.value.map(stripBitmap),
      texts: texts.value.map(tx => ({ ...tx })),
      trimStart: trimStart.value,
      trimEnd: trimEnd.value,
      resolution: resolution.value,
      preset: preset.value,
      selectedImageId: selectedImageId.value,
      selectedCueIndex: selectedCueIndex.value,
      selectedKeyframeId: selectedKeyframeId.value,
      selectedTextId: selectedTextId.value,
    }
  }

  // A stable string identifying the undoable state. Caption offsets and a
  // keyframed clip's framing are derived from keyframes when any exist, so they're
  // dropped from the key there — that keeps scrub/playback (which rewrites both for
  // display) out of history while real keyframe edits still register via `keyframes`.
  const historyKey = computed(() => {
    const ctrl = keyframes.value.length ? stripOffsets(controls) : { ...controls }
    return JSON.stringify({
      ctrl,
      audio: { ...audio },
      cues: cues.value,
      keyframes: keyframes.value,
      images: images.value.map(stripFramingIfKeyed),
      texts: texts.value,
      trimStart: trimStart.value,
      trimEnd: trimEnd.value,
      resolution: resolution.value,
    })
  })

  function stripOffsets(c) {
    const copy = { ...c }
    delete copy.offsetXPct
    delete copy.offsetYPct
    return copy
  }

  // For history only: drop a clip's framing when keyframes drive it, so scrubbing
  // (which rewrites zoom/pan for display) doesn't churn the undo stack.
  function stripFramingIfKeyed(im) {
    const copy = stripBitmap(im)
    if (keyframes.value.some(k => k.t >= im.start && k.t < im.end)) {
      delete copy.zoom
      delete copy.offsetXPct
      delete copy.offsetYPct
    }
    return copy
  }

  function commitHistory() {
    if (!present) {
      present = docSnapshot()
      return
    }
    past.value.push(present)
    if (past.value.length > HISTORY_LIMIT) {
      past.value.shift()
    }
    present = docSnapshot()
    future.value = []
  }

  watch(historyKey, () => {
    if (!historyReady || restoring) {
      return
    }
    if (historyTimer) {
      clearTimeout(historyTimer)
    }
    // Coalesce rapid edits (drags, slider sweeps, typing) into one undo step.
    historyTimer = setTimeout(() => {
      historyTimer = null
      if (!restoring) {
        commitHistory()
      }
    }, 400)
  })

  function applySnapshot(snap) {
    if (!snap) {
      return
    }
    restoring = true
    loadingKeyframe = true
    applyingPreset = true

    Object.assign(controls, snap.controls)
    if (snap.audio) {
      Object.assign(audio, snap.audio)
    }
    cues.value = snap.cues.map(c => ({ ...c }))
    keyframes.value = snap.keyframes.map(k => ({ ...k, values: { ...k.values } }))
    texts.value = (snap.texts || []).map(tx => ({ ...tx }))
    images.value = snap.images
      .map(im => ({ ...im, bitmap: bitmapRegistry.get(im.id) }))
      .filter(im => im.bitmap)
    trimStart.value = snap.trimStart
    trimEnd.value = snap.trimEnd
    resolution.value = snap.resolution
    preset.value = snap.preset

    // Restore selections, falling back when the target no longer exists.
    selectedImageId.value = images.value.some(im => im.id === snap.selectedImageId)
      ? snap.selectedImageId
      : (images.value[0]?.id ?? null)
    selectedCueIndex.value =
      snap.selectedCueIndex != null && cues.value[snap.selectedCueIndex]
        ? snap.selectedCueIndex
        : null
    selectedKeyframeId.value = keyframes.value.some(k => k.id === snap.selectedKeyframeId)
      ? snap.selectedKeyframeId
      : null
    selectedTextId.value = texts.value.some(tx => tx.id === snap.selectedTextId)
      ? snap.selectedTextId
      : null
    if (!images.value.length) {
      dragTarget.value = 'caption'
    }

    nextTick(() => {
      restoring = false
      loadingKeyframe = false
      applyingPreset = false
    })
    redraw()
    maybeReady()
  }

  // Commit an edit still inside its debounce window so it's on the stack before
  // we navigate history (otherwise an in-flight change would be lost).
  function flushHistory() {
    if (historyTimer) {
      clearTimeout(historyTimer)
      historyTimer = null
      if (!restoring) {
        commitHistory()
      }
    }
  }

  function undo() {
    flushHistory()
    if (!past.value.length) {
      return
    }
    future.value.unshift(present)
    present = past.value.pop()
    applySnapshot(present)
  }

  function redo() {
    flushHistory()
    if (!future.value.length) {
      return
    }
    past.value.push(present)
    present = future.value.shift()
    applySnapshot(present)
  }

  // Begin recording from a clean baseline once startup (demo media, presets) is
  // settled, so initial loading never lands on the undo stack.
  function beginHistory() {
    if (historyTimer) {
      clearTimeout(historyTimer)
      historyTimer = null
    }
    present = docSnapshot()
    past.value = []
    future.value = []
    historyReady = true
  }

  async function loadAudio(file) {
    if (!file) {
      audioBuffer.value = null
      rawAudio = null
      trimStart.value = 0
      trimEnd.value = 0
      maybeReady()
      return true
    }
    setStatus('status.decoding')
    try {
      const buf = await decodeAudioFile(file)
      if (buf.duration > MAX_AUDIO_SEC) {
        audioBuffer.value = null
        setStatus('status.overLimit', { duration: fmt(buf.duration) })
        log(`Rejected audio: ${buf.duration.toFixed(1)}s`)
        return false
      }
      audioBuffer.value = buf
      rawAudio = file
      trimStart.value = 0
      trimEnd.value = buf.duration
      log(`Audio: ${buf.duration.toFixed(2)}s, ${buf.numberOfChannels}ch, ${buf.sampleRate}Hz`)
    } catch (err) {
      audioBuffer.value = null
      setStatus('status.decodeFailed')
      log('Audio decode error: ' + (err?.message || err))
      return false
    } finally {
      clampScrub()
      redraw()
      maybeReady()
    }
    return true
  }

  async function loadMusic(file) {
    if (!file) {
      musicBuffer.value = null
      musicName.value = ''
      rawMusic = null
      redraw()
      return true
    }
    setStatus('status.decoding')
    try {
      const buf = await decodeAudioFile(file)
      if (buf.duration > MAX_AUDIO_SEC) {
        musicBuffer.value = null
        setStatus('status.overLimit', { duration: fmt(buf.duration) })
        log(`Rejected music: ${buf.duration.toFixed(1)}s`)
        return false
      }
      musicBuffer.value = buf
      rawMusic = file
      musicName.value = file.name || 'music'
      maybeReady()
      log(`Music: ${buf.duration.toFixed(2)}s, ${buf.numberOfChannels}ch, ${buf.sampleRate}Hz`)
    } catch (err) {
      musicBuffer.value = null
      setStatus('status.decodeFailed')
      log('Music decode error: ' + (err?.message || err))
      return false
    } finally {
      redraw()
    }
    return true
  }

  const MIN_IMAGE_DUR = 0.5

  function sortImages() {
    images.value = [...images.value].sort((a, b) => a.start - b.start)
  }

  // Append one decoded image as a slideshow clip. The first clip spans the whole
  // timeline; later ones default to a 3s slot at the playhead so they don't hide
  // earlier clips.
  async function addImageFile(file, name) {
    const bitmap = await createImageBitmap(file)
    const dur = previewDuration.value
    let start, end
    if (!images.value.length) {
      start = 0
      end = dur
    } else {
      start = Math.min(Math.max(0, scrub.value), Math.max(0, dur - MIN_IMAGE_DUR))
      end = Math.min(start + 3, dur)
      if (end - start < MIN_IMAGE_DUR) {
        start = Math.max(0, dur - 3)
        end = dur
      }
    }
    const clip = {
      id: ++imageCounter,
      bitmap,
      name: name || `image ${imageCounter}`,
      width: bitmap.width,
      height: bitmap.height,
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
      fit: 'contain',
      zoom: 1,
      offsetXPct: 0,
      offsetYPct: 0,
      rotation: 0,
      cropTop: 0,
      cropBottom: 0,
      cropLeft: 0,
      cropRight: 0,
      effect: 'vivid',
      fadeIn: 0,
      fadeOut: 0,
    }
    bitmapRegistry.set(clip.id, bitmap)
    imageBlobs.set(clip.id, file)
    images.value.push(clip)
    sortImages()
    selectedImageId.value = clip.id
    log(
      `Image: ${clip.name} ${bitmap.width}×${bitmap.height} (${fmt(clip.start)}–${fmt(clip.end)}).`,
    )
    return clip
  }

  async function addImages(files) {
    const list = Array.from(files || [])
    for (const file of list) {
      try {
        await addImageFile(file, file.name)
      } catch (err) {
        log('Image load failed: ' + (err?.message || err))
      }
    }
    redraw()
    maybeReady()
  }

  function clearImages() {
    images.value = []
    imageBlobs.clear()
    selectedImageId.value = null
    dragTarget.value = 'caption'
    redraw()
    maybeReady()
  }

  // Route a dropped/selected set of files to the right loader by type: images →
  // slideshow clips, the first audio → voice (a second → the music bed), .srt →
  // captions, fonts → caption fonts. Unsupported files are logged and skipped.
  async function importFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) {
      return
    }
    const imgs = []
    const fonts = []
    let audio = null
    let music = null
    let srt = null
    for (const f of files) {
      const name = (f.name || '').toLowerCase()
      const type = f.type || ''
      if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/.test(name)) {
        imgs.push(f)
      } else if (type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/.test(name)) {
        if (!audio) {
          audio = f
        } else if (!music) {
          music = f
        }
      } else if (name.endsWith('.srt')) {
        srt = srt || f
      } else if (/\.(ttf|otf)$/.test(name) || type.includes('font')) {
        fonts.push(f)
      } else {
        log(`Skipped unsupported file: ${f.name}`)
      }
    }
    if (audio) {
      await loadAudio(audio)
    }
    if (music) {
      await loadMusic(music)
    }
    if (imgs.length) {
      await addImages(imgs)
    }
    if (srt) {
      await loadSrt(srt)
    }
    if (fonts.length) {
      await loadFonts(fonts)
    }
    const parts = []
    if (audio) {
      parts.push('audio')
    }
    if (music) {
      parts.push('music')
    }
    if (imgs.length) {
      parts.push(`${imgs.length} image${imgs.length > 1 ? 's' : ''}`)
    }
    if (srt) {
      parts.push('captions')
    }
    if (fonts.length) {
      parts.push(`${fonts.length} font${fonts.length > 1 ? 's' : ''}`)
    }
    if (parts.length) {
      log(`Imported ${parts.join(', ')}.`)
    }
  }

  function removeImage(id) {
    images.value = images.value.filter(im => im.id !== id)
    imageBlobs.delete(id)
    if (selectedImageId.value === id) {
      selectedImageId.value = images.value.length ? images.value[0].id : null
    }
    if (!images.value.length) {
      dragTarget.value = 'caption'
    }
    redraw()
    maybeReady()
  }

  const r3 = v => Math.round(v * 1000) / 1000

  // Split the clip under the playhead into two halves at the playhead; both keep
  // the same framing/effect and share the bitmap. No-op unless the playhead sits
  // comfortably inside the clip.
  function splitImageAt(id) {
    const im = images.value.find(c => c.id === id)
    if (!im) {
      return
    }
    const t = r3(scrub.value)
    if (t <= im.start + MIN_IMAGE_DUR || t >= im.end - MIN_IMAGE_DUR) {
      return
    }
    const right = { ...im, id: ++imageCounter, start: t }
    im.end = t
    bitmapRegistry.set(right.id, im.bitmap)
    if (imageBlobs.has(im.id)) {
      imageBlobs.set(right.id, imageBlobs.get(im.id))
    }
    images.value.push(right)
    sortImages()
    selectedImageId.value = right.id
    redraw()
  }

  // Duplicate a clip, dropping the copy right after it (or at the playhead when
  // there's no room before the timeline end).
  function duplicateImage(id) {
    const im = images.value.find(c => c.id === id)
    if (!im) {
      return
    }
    const dur = previewDuration.value
    const len = im.end - im.start
    let start = im.end
    let end = Math.min(start + len, dur)
    if (end - start < MIN_IMAGE_DUR) {
      start = Math.min(Math.max(0, scrub.value), Math.max(0, dur - len))
      end = Math.min(start + len, dur)
    }
    const copy = { ...im, id: ++imageCounter, start: r3(start), end: r3(end) }
    bitmapRegistry.set(copy.id, im.bitmap)
    if (imageBlobs.has(im.id)) {
      imageBlobs.set(copy.id, imageBlobs.get(im.id))
    }
    images.value.push(copy)
    sortImages()
    selectedImageId.value = copy.id
    redraw()
  }

  function selectImage(id) {
    selectedImageId.value = id
    inspectorTab.value = 'image'
    // Focusing a layer makes it the target of preview drag/resize (the manual
    // Caption/Image/Title toggle was removed in favour of selection-driven focus).
    dragTarget.value = 'image'
    const im = images.value.find(c => c.id === id)
    // Bring the clip on screen so inspector edits are visible (WYSIWYG).
    if (im && (scrub.value < im.start || scrub.value >= im.end)) {
      seek(im.start)
    }
  }

  function updateImageTime(id, start, end) {
    const im = images.value.find(c => c.id === id)
    if (!im) {
      return
    }
    const dur = previewDuration.value
    const s = Math.max(0, Math.min(start, dur - MIN_IMAGE_DUR))
    const e = Math.min(dur, Math.max(end, s + MIN_IMAGE_DUR))
    im.start = Math.round(s * 1000) / 1000
    im.end = Math.round(e * 1000) / 1000
    sortImages()
    redraw()
  }

  async function loadSrt(file) {
    if (!file) {
      cues.value = []
      selectedCueIndex.value = null
      clampScrub()
      redraw()
      maybeReady()
      return
    }
    cues.value = parseSRT(await file.text())
    selectedCueIndex.value = null
    log(`Parsed ${cues.value.length} cues, spanning ${srtSpan.value.toFixed(1)}s.`)
    if (!cues.value.length) {
      setStatus('status.noCues')
    }
    clampScrub()
    redraw()
    maybeReady()
  }

  const loadedFamilies = new Set()

  async function ensureBundledFont(family) {
    if (!family || family === 'default' || loadedFamilies.has(family)) {
      return
    }
    const entry = KHMER_FONTS.find(f => f.family === family)
    if (!entry) {
      return
    }
    try {
      const ff = new FontFace(family, `url("${entry.url}")`)
      await ff.load()
      document.fonts.add(ff)
      loadedFamilies.add(family)
      log(`Loaded font "${entry.label}".`)
    } catch (err) {
      log(`Could not load font "${entry.label}": ${err?.message || err}`)
    }
  }

  // Registers a font buffer as a FontFace and adds it to the dropdown.
  // Returns the entry (without persisting it).
  async function registerFontBuffer(buffer, name, id = null) {
    const ff = new FontFace('UserFont' + ++fontCounter, buffer)
    await ff.load()
    document.fonts.add(ff)
    const entry = { value: ff.family, label: name, face: ff, id }
    customFonts.value.push(entry)
    return entry
  }

  async function loadFont(file) {
    if (!file) {
      return
    }
    setStatus('status.loadingFont')
    try {
      const buffer = await file.arrayBuffer()
      const entry = await registerFontBuffer(buffer, file.name)
      entry.id = await idbPutFont(file.name, buffer)
      controls.fontKey = entry.value
      redraw()
      log(`Loaded font "${file.name}" as ${entry.value}.`)
      setStatus(audioBuffer.value ? 'status.ready' : 'status.fontLoaded')
    } catch (err) {
      log('Font upload failed: ' + (err?.message || err))
      setStatus('status.fontFailed')
    }
  }

  async function loadFonts(files) {
    for (const file of Array.from(files || [])) {
      await loadFont(file)
    }
  }

  // Re-registers fonts saved from previous sessions on startup.
  async function restoreCustomFonts() {
    let records
    try {
      records = await idbGetAllFonts()
    } catch (err) {
      log('Could not read saved fonts: ' + (err?.message || err))
      return
    }
    if (!records.length) {
      return
    }
    let last = null
    for (const rec of records) {
      try {
        last = await registerFontBuffer(rec.buffer, rec.name, rec.id)
      } catch (err) {
        log(`Could not restore font "${rec.name}": ${err?.message || err}`)
      }
    }
    if (last) {
      controls.fontKey = last.value
      redraw()
      log(`Restored ${customFonts.value.length} saved font(s).`)
    }
  }

  async function clearCustomFonts() {
    for (const f of customFonts.value) {
      if (f.face) {
        document.fonts.delete(f.face)
      }
    }
    customFonts.value = []
    if (!fontOptions.value.some(o => o.value === controls.fontKey)) {
      controls.fontKey = 'default'
    }
    redraw()
    try {
      await idbClearFonts()
    } catch (err) {
      log('Could not clear saved fonts: ' + (err?.message || err))
    }
    log('Cleared custom fonts.')
  }

  async function ensureDefaultFonts() {
    try {
      await Promise.all([
        document.fonts.load(`700 64px ${KHMER_FONT}`),
        document.fonts.load(`400 64px ${KHMER_FONT}`),
      ])
      await document.fonts.ready
      await ensureBundledFont(controls.fontKey)
      log('Default Khmer font ready.')
    } catch (e) {
      log('Font load warning: ' + e)
    }
  }

  async function ensureRenderFont() {
    try {
      if (controls.fontKey !== 'default') {
        await ensureBundledFont(controls.fontKey)
        await document.fonts.load(`${controls.fontWeight} 64px "${controls.fontKey}"`)
      }
      // Title overlays can each pick their own font — load those too so frames
      // don't encode with a fallback.
      const titleFonts = new Set(
        texts.value.map(tx => tx.fontKey).filter(key => key && key !== 'default'),
      )
      for (const key of titleFonts) {
        await ensureBundledFont(key)
        await document.fonts.load(`64px "${key}"`)
      }
      await document.fonts.load(`${controls.fontWeight} 64px "Noto Sans Khmer"`)
      await document.fonts.ready
    } catch (e) {
      log('Font readiness warning: ' + e)
    }
  }

  async function runEnvCheck() {
    const MB = await loadMediabunny(log)
    const r = await pickPipeline(MB, 1080, 1920)
    const mr = mrType()

    if (!r.error) {
      envState.value = {
        level: r.fallback ? 'warn' : 'good',
        titleKey: 'env.fast',
        titleParams: { label: r.label },
        noteKey: r.fallback ? 'env.fastFallbackNote' : 'env.fastNote',
      }
    } else if (mr) {
      envState.value = {
        level: 'warn',
        titleKey: 'env.realtime',
        titleParams: { kind: mr.startsWith('video/mp4') ? 'MP4' : 'WebM' },
        noteKey: 'env.realtimeNote',
      }
    } else {
      envState.value = {
        level: 'bad',
        titleKey: 'env.none',
        noteKey: 'env.noneNote',
      }
    }
    log('Env: ' + (r.error ? (mr ? 'realtime ' + mr : 'none') : r.label))
  }

  function presentResult(r, dur) {
    if (result.value?.url) {
      URL.revokeObjectURL(result.value.url)
    }
    result.value = {
      url: URL.createObjectURL(r.blob),
      label: r.label,
      sizeMB: (r.blob.size / 1048576).toFixed(2),
      dur: dur.toFixed(2),
      frames: r.frames,
      ratio: r.ratio.toFixed(1),
      ext: r.ext,
    }
    progress.value = 1
    setStatus('status.rendered')
  }

  // Open the export-settings dialog (quality/format/fps), unless a render is
  // already running. The dialog's confirm button calls render().
  function openExportDialog() {
    if (canRender.value) {
      exportDialog.value = true
    }
  }

  async function render() {
    if (busy.value || !audioBuffer.value) {
      return
    }
    exportDialog.value = false
    pause()
    cancelRequested = false
    busy.value = true
    result.value = null
    showProgress.value = true
    progress.value = 0

    try {
      await ensureRenderFont()
      const { w, h } = dimensions.value
      const { from, to } = trimWindow.value
      const dur = to - from
      const MB = await loadMediabunny(log)
      const quality =
        QUALITY_OPTIONS.find(o => o.value === exportSettings.quality) || QUALITY_OPTIONS[0]
      const pipe = await pickPipeline(MB, w, h, exportSettings.format)

      if (hasTrim.value) {
        log(
          `Trim: ${fmt(from)}–${fmt(to)} of ${fmt(audioBuffer.value.duration)} (output ${fmt(dur)}).`,
        )
      }

      // Pre-mix voice + music (gain, fades, loop, ducking) into one buffer spanning
      // the trim window, so both encode paths just mux a finished audio track.
      setStatusRaw('Mixing audio…')
      const mixedAudio = await renderMix({
        voice: audioBuffer.value,
        music: musicBuffer.value,
        from,
        to,
        ...audio,
      })
      if (musicBuffer.value) {
        log(
          `Audio mix: voice ${audio.voiceGain.toFixed(2)}× + music ${audio.musicGain.toFixed(2)}×` +
            `${audio.ducking ? ' (ducked)' : ''}${audio.musicLoop ? ' (looped)' : ''}.`,
        )
      }

      const renderCtx = {
        mixedAudio,
        from,
        to,
        cues: cues.value,
        style: style.value,
        images: images.value,
        keyframes: keyframes.value,
        texts: texts.value,
        logo: logoResolved.value,
        fps: exportSettings.fps,
        qualityKey: quality.mbKey,
        mrBitrate: quality.mrBitrate,
        onProgress: p => {
          progress.value = p
        },
        onStatus: m => {
          setStatusRaw(m)
        },
        log,
        isCancelled: () => cancelRequested,
      }

      let res
      if (!pipe.error) {
        log(`--- Fast encode @ ${w}x${h}, ${dur.toFixed(2)}s, font ${controls.fontKey} ---`)
        if (srtSpan.value > to + 0.05) {
          log(
            `Note: captions run to ${srtSpan.value.toFixed(1)}s but the kept range ends at ${to.toFixed(1)}s; trailing captions cut.`,
          )
        }
        log('Pipeline: ' + pipe.label)
        res = await generateFast(MB, pipe, w, h, dur, renderCtx)
      } else if (mrType()) {
        log(`--- Realtime fallback @ ${w}x${h}, ${dur.toFixed(2)}s ---`)
        if (dur > 30) {
          log(`Heads up: realtime path will take about ${fmt(dur)}.`)
        }
        res = await generateRealtime(w, h, dur, renderCtx)
      } else {
        throw new Error('No encoder available in this browser. Use desktop Chrome or Edge.')
      }

      if (cancelRequested || !res) {
        setStatus('status.stopped')
        log('Generation cancelled.')
        return
      }
      log(`Done in ${res.secs.toFixed(2)}s (${res.ratio.toFixed(1)}× realtime).`)
      presentResult(res, dur)
    } catch (err) {
      console.error(err)
      log('ERROR: ' + (err?.message || err))
      setStatus('status.renderFailed')
    } finally {
      busy.value = false
      maybeReady()
    }
  }

  function cancel() {
    cancelRequested = true
    setStatus('status.stopping')
    log('Cancel requested.')
  }

  // Export the frame at the current playhead as a full-resolution PNG — a video
  // cover/thumbnail. Same drawFrame the encoder uses, so it matches the output.
  async function exportThumbnail() {
    if (busy.value) {
      return
    }
    pause()
    try {
      await ensureRenderFont()
      const { w, h } = dimensions.value
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      drawFrame(cv.getContext('2d'), w, h, scrub.value, {
        images: images.value,
        cues: cues.value,
        style: style.value,
        keyframes: keyframes.value,
        texts: texts.value,
        logo: logoResolved.value,
      })
      const blob = await new Promise(resolve => cv.toBlob(resolve, 'image/png'))
      if (!blob) {
        throw new Error('toBlob returned null')
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = t('result.thumbnailName')
      a.click()
      URL.revokeObjectURL(url)
      log(`Thumbnail saved: ${w}×${h}, ${(blob.size / 1024).toFixed(0)} KB at ${timeLabel.value}.`)
      setStatus('status.thumbnailSaved')
    } catch (err) {
      log('Thumbnail export failed: ' + (err?.message || err))
      setStatus('status.thumbnailFailed')
    }
  }

  // A single AudioContext is created once and reused: iOS rate-limits how many
  // can exist, and closing/recreating one per play is what causes playback to
  // silently fail after a few taps.
  function ensureAudioContext() {
    if (!playCtx) {
      const AC = window.AudioContext || window.webkitAudioContext
      playCtx = new AC()
    }
    return playCtx
  }

  function stopPlaybackAudio() {
    for (const ref of ['playSource', 'playMusicSource']) {
      const node = ref === 'playSource' ? playSource : playMusicSource
      if (node) {
        try {
          node.stop()
        } catch {
          /* already stopped */
        }
        try {
          node.disconnect()
        } catch {
          /* not connected */
        }
      }
    }
    if (playMasterGain) {
      try {
        playMasterGain.disconnect()
      } catch {
        /* not connected */
      }
    }
    playSource = null
    playMusicSource = null
    playMasterGain = null
  }

  function pause() {
    if (playRaf) {
      cancelAnimationFrame(playRaf)
      playRaf = null
    }
    stopPlaybackAudio()
    isPlaying.value = false
  }

  async function play() {
    if (isPlaying.value) {
      return
    }
    // Playback is bound to the trim window; full clip when nothing is trimmed.
    const { from, to } = trimWindow.value
    const dur = to
    if (scrub.value < from || scrub.value >= to) {
      scrub.value = from
    }
    isPlaying.value = true
    playStartOffset = scrub.value

    if (audioBuffer.value) {
      // iOS routes Web Audio to the ringer channel by default, so the hardware
      // mute switch / silent mode kills it. Asking for the "playback" session
      // routes it to the media channel that ignores the mute switch (iOS 16.4+).
      try {
        if (navigator.audioSession) {
          navigator.audioSession.type = 'playback'
        }
      } catch {
        /* audioSession unsupported */
      }

      const ctx = ensureAudioContext()
      // iOS hands back a suspended context; it must be resumed within the tap.
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume()
        } catch {
          /* resume rejected */
        }
      }
      // The user may have hit stop during the await.
      if (!isPlaying.value) {
        return
      }

      // Master gain carries the preview-monitor volume/mute; voice and music both
      // route through it, so a slider/mute change applies live (see the watcher).
      const master = ctx.createGain()
      master.gain.value = monitorGain.value
      master.connect(ctx.destination)
      playMasterGain = master

      // Voice through a gain node so the preview reflects the mix level. Fades and
      // ducking are render-time shaping (they depend on the absolute window) and
      // are not reproduced here, where playback can start at any scrubbed point.
      playSource = ctx.createBufferSource()
      playSource.buffer = audioBuffer.value
      const voiceGain = ctx.createGain()
      voiceGain.gain.value = audio.voiceGain
      playSource.connect(voiceGain).connect(master)
      playSource.start(0, playStartOffset)

      // Background-music bed, aligned to the timeline so it stays in sync with the
      // voice as you scrub: offset into the loop by how far past `from` we start.
      if (musicBuffer.value) {
        const m = ctx.createBufferSource()
        m.buffer = musicBuffer.value
        m.loop = audio.musicLoop
        const mGain = ctx.createGain()
        mGain.gain.value = audio.musicGain
        m.connect(mGain).connect(master)
        const into = Math.max(0, playStartOffset - from)
        const offset = audio.musicLoop ? into % musicBuffer.value.duration : into
        if (audio.musicLoop || offset < musicBuffer.value.duration) {
          m.start(0, offset)
          playMusicSource = m
        }
      }
      playStartClock = ctx.currentTime
    } else {
      playStartClock = performance.now() / 1000
    }

    const tick = () => {
      if (!isPlaying.value) {
        return
      }
      const now = audioBuffer.value && playCtx ? playCtx.currentTime : performance.now() / 1000
      const t = playStartOffset + (now - playStartClock)
      if (t >= dur) {
        // Loop the play region instead of stopping, when the region is long
        // enough to be worth replaying. Tear down the current audio/raf and
        // restart from the region start.
        if (loopPlayback.value && dur - from > 0.05) {
          stopPlaybackAudio()
          if (playRaf) {
            cancelAnimationFrame(playRaf)
            playRaf = null
          }
          isPlaying.value = false
          scrub.value = from
          play()
          return
        }
        scrub.value = dur
        pause()
        return
      }
      scrub.value = t
      playRaf = requestAnimationFrame(tick)
    }
    playRaf = requestAnimationFrame(tick)
  }

  function togglePlay() {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  function toggleMute() {
    muted.value = !muted.value
  }

  // Push monitor volume/mute changes to the live master gain so they take effect
  // mid-playback without restarting the audio graph.
  watch(monitorGain, g => {
    if (playMasterGain && playCtx) {
      playMasterGain.gain.value = g
    }
  })

  function seek(t) {
    pause()
    scrub.value = Math.min(Math.max(t, 0), previewDuration.value)
  }

  // Keyboard transport: nudge the playhead by a frame (≈1/30s) or a second.
  function nudge(seconds) {
    seek(scrub.value + seconds)
  }

  // Jump the playhead to the previous/next caption boundary (cue start or end),
  // falling back to the clip start/end at the extremes.
  function jumpCue(dir) {
    const eps = 1e-3
    const bounds = []
    for (const c of cues.value) {
      bounds.push(c.start, c.end)
    }
    bounds.sort((a, b) => a - b)
    if (dir > 0) {
      const next = bounds.find(b => b > scrub.value + eps)
      seek(next != null ? next : previewDuration.value)
    } else {
      const prev = bounds.filter(b => b < scrub.value - eps).pop()
      seek(prev != null ? prev : 0)
    }
  }

  // ---- Timeline snapping ----------------------------------------------------
  // Pixel radius within which a dragged edge sticks to a candidate; converted to
  // seconds per drag via the current pxPerSecond, so it feels the same at any zoom.
  const SNAP_PX = 7

  // Candidate snap times: timeline ends, every cue and image-clip edge, and
  // (optionally) the playhead. `exclude` drops a dragged element's own edges so it
  // can't snap to itself.
  function snapCandidates(exclude, includePlayhead) {
    const ex = v => exclude.some(e => Math.abs(e - v) < 1e-4)
    const out = [0, previewDuration.value]
    for (const c of cues.value) {
      out.push(c.start, c.end)
    }
    for (const im of images.value) {
      out.push(im.start, im.end)
    }
    if (includePlayhead) {
      out.push(scrub.value)
    }
    return out.filter(v => !ex(v))
  }

  function nearestSnap(t, candidates, tol) {
    let best = null
    let bestDist = tol
    for (const c of candidates) {
      const d = Math.abs(c - t)
      if (d <= bestDist) {
        bestDist = d
        best = c
      }
    }
    return best
  }

  // Snap a single edge/time (playhead, trim handle, keyframe, or a resized clip
  // edge). Sets the guide to the snapped point (or clears it) and returns the
  // resolved time. `disabled` (Alt held / snapping off) is a passthrough.
  function snapEdge(t, { pxPerSecond, exclude = [], includePlayhead = true, disabled = false }) {
    if (disabled || !snapEnabled.value || !pxPerSecond) {
      snapGuide.value = null
      return t
    }
    const best = nearestSnap(t, snapCandidates(exclude, includePlayhead), SNAP_PX / pxPerSecond)
    snapGuide.value = best
    return best != null ? best : t
  }

  // Snap a whole clip being moved: try snapping either edge and apply whichever
  // sticks closer, keeping the clip's duration. Returns the resolved start.
  function snapClip(rawStart, dur, { pxPerSecond, exclude = [], disabled = false }) {
    if (disabled || !snapEnabled.value || !pxPerSecond) {
      snapGuide.value = null
      return rawStart
    }
    const tol = SNAP_PX / pxPerSecond
    const cand = snapCandidates(exclude, true)
    const snapS = nearestSnap(rawStart, cand, tol)
    const snapE = nearestSnap(rawStart + dur, cand, tol)
    const dS = snapS != null ? Math.abs(snapS - rawStart) : Infinity
    const dE = snapE != null ? Math.abs(snapE - (rawStart + dur)) : Infinity
    if (snapS != null && dS <= dE) {
      snapGuide.value = snapS
      return snapS
    }
    if (snapE != null) {
      snapGuide.value = snapE
      return snapE - dur
    }
    snapGuide.value = null
    return rawStart
  }

  function clearSnap() {
    snapGuide.value = null
  }

  function openContextMenu(event, items) {
    event.preventDefault()
    event.stopPropagation()
    contextMenu.value = { open: true, x: event.clientX, y: event.clientY, items }
  }

  function closeContextMenu() {
    if (contextMenu.value.open) {
      contextMenu.value = { ...contextMenu.value, open: false }
    }
  }

  const TIMELINE_MIN_ZOOM = 0.25
  const TIMELINE_MAX_ZOOM = 24
  function zoomTimeline(action) {
    if (action === 'in') {
      timelineZoom.value = Math.min(timelineZoom.value * 1.5, TIMELINE_MAX_ZOOM)
    } else if (action === 'out') {
      timelineZoom.value = Math.max(timelineZoom.value / 1.5, TIMELINE_MIN_ZOOM)
    } else {
      timelineZoom.value = 1
    }
  }

  // Delete whatever is selected in the timeline (keyframe takes priority over a
  // caption cue). Returns true when something was removed, so the key handler can
  // swallow the event only then.
  function deleteSelected() {
    if (selectedKeyframeId.value != null) {
      removeKeyframe(selectedKeyframeId.value)
      return true
    }
    if (selectedTextId.value != null) {
      removeText(selectedTextId.value)
      return true
    }
    if (selectedCueIndex.value != null) {
      removeCue(selectedCueIndex.value)
      return true
    }
    return false
  }

  function updateCue(index, start, end) {
    const cue = cues.value[index]
    if (!cue) {
      return
    }
    const minDur = 0.1
    const s = Math.max(0, start)
    const e = Math.max(s + minDur, end)
    cue.start = Math.round(s * 1000) / 1000
    cue.end = Math.round(e * 1000) / 1000
    redraw()
  }

  function selectCue(index) {
    selectedCueIndex.value = index
    // Caption and title selection are mutually exclusive, so Delete is unambiguous.
    if (index != null) {
      selectedTextId.value = null
      inspectorTab.value = 'style'
      // Focusing a caption makes it the preview drag/resize target.
      dragTarget.value = 'caption'
    }
  }

  function setCueText(index, text) {
    const cue = cues.value[index]
    if (!cue) {
      return
    }
    cue.text = text
    redraw()
  }

  // Navigate to a cue from the cue-list panel: seek to its start and select it,
  // but keep the active inspector tab (the list lives in its own tab, so a row
  // click shouldn't bounce the panel to Style like selectCue does).
  function goToCue(index) {
    const cue = cues.value[index]
    if (!cue) {
      return
    }
    selectedCueIndex.value = index
    selectedTextId.value = null
    dragTarget.value = 'caption'
    seek(cue.start)
  }

  function addCue() {
    const dur = previewDuration.value
    const start = Math.min(scrub.value, Math.max(0, dur - 1))
    const end = Math.max(Math.min(start + 2, dur), start + 0.5)
    cues.value.push({
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
      text: 'New caption',
    })
    selectedCueIndex.value = cues.value.length - 1
    redraw()
    maybeReady()
  }

  // Create a caption from explicit values (used by the add/edit dialog).
  function addCaption(text, start, end) {
    const dur = previewDuration.value
    const s = Math.max(0, Math.min(start, dur - 0.1))
    const e = Math.max(s + 0.1, Math.min(end, dur))
    cues.value.push({
      start: Math.round(s * 1000) / 1000,
      end: Math.round(e * 1000) / 1000,
      text,
    })
    selectedCueIndex.value = cues.value.length - 1
    redraw()
    maybeReady()
  }

  function openAddCaption() {
    captionDialog.value = { open: true, mode: 'add', index: null }
  }

  function openEditCaption(index) {
    if (!cues.value[index]) {
      return
    }
    selectedCueIndex.value = index
    captionDialog.value = { open: true, mode: 'edit', index }
  }

  function closeCaptionDialog() {
    captionDialog.value = { ...captionDialog.value, open: false }
  }

  function removeCue(index) {
    if (index == null || !cues.value[index]) {
      return
    }
    cues.value.splice(index, 1)
    selectedCueIndex.value = null
    redraw()
    maybeReady()
  }

  // Split the caption under the playhead at the playhead; both halves keep the
  // text (the user retimes/edits each). No-op unless the playhead is inside it.
  function splitCueAt(index) {
    const cue = cues.value[index]
    if (!cue) {
      return
    }
    const t = r3(scrub.value)
    const MIN = 0.1
    if (t <= cue.start + MIN || t >= cue.end - MIN) {
      return
    }
    const right = { ...cue, start: t }
    cue.end = t
    cues.value.splice(index + 1, 0, right)
    selectedCueIndex.value = index + 1
    redraw()
  }

  function duplicateCue(index) {
    const cue = cues.value[index]
    if (!cue) {
      return
    }
    const dur = previewDuration.value
    const len = cue.end - cue.start
    let start = cue.end
    let end = Math.min(start + len, dur)
    if (end - start < 0.1) {
      start = Math.max(0, Math.min(scrub.value, dur - len))
      end = Math.min(start + len, dur)
    }
    cues.value.splice(index + 1, 0, { ...cue, start: r3(start), end: r3(end) })
    selectedCueIndex.value = index + 1
    redraw()
    maybeReady()
  }

  // ---- Title text overlays --------------------------------------------------
  // Free-floating, time-ranged titles drawn over the scene, independent of the
  // SRT captions. Edited in the Overlay inspector tab.
  const MIN_TEXT_DUR = 0.3

  function addText() {
    const dur = previewDuration.value
    const start = Math.min(Math.max(0, scrub.value), Math.max(0, dur - MIN_TEXT_DUR))
    const end = Math.min(start + 2.5, dur)
    const item = {
      id: ++textCounter,
      text: t('textOverlay.defaultText'),
      start: r3(start),
      end: r3(Math.max(end, start + MIN_TEXT_DUR)),
      x: 0.5,
      y: 0.16,
      fontKey: controls.fontKey,
      fontSizePct: 0.06,
      bold: true,
      color: '#ffffff',
      strokeColor: '#000000',
      strokePct: 0.08,
    }
    texts.value = [...texts.value, item]
    selectedTextId.value = item.id
    redraw()
    maybeReady()
    return item
  }

  function updateText(id, patch) {
    texts.value = texts.value.map(tx => (tx.id === id ? { ...tx, ...patch } : tx))
    redraw()
  }

  // Titles can use any caption font (bundled Khmer or uploaded). Lazily load the
  // bundled font so the preview repaints with real glyphs instead of a fallback.
  function setTextFont(id, fontKey) {
    updateText(id, { fontKey })
    ensureBundledFont(fontKey).then(redraw)
  }

  // Retime a title from the timeline (drag/resize), clamped to the clip and a
  // minimum length — the inspector no longer carries start/end number inputs.
  function updateTextTime(id, start, end) {
    const tx = texts.value.find(x => x.id === id)
    if (!tx) {
      return
    }
    const dur = previewDuration.value
    const s = Math.max(0, Math.min(start, dur - MIN_TEXT_DUR))
    const e = Math.min(dur, Math.max(end, s + MIN_TEXT_DUR))
    updateText(id, { start: r3(s), end: r3(e) })
  }

  // Reposition a title by dragging it on the preview. x/y are the centre as
  // fractions of the frame, clamped to stay on-screen.
  function setTextPos(id, x, y) {
    const c = v => (v < 0 ? 0 : v > 1 ? 1 : v)
    updateText(id, { x: c(x), y: c(y) })
  }

  function removeText(id) {
    texts.value = texts.value.filter(tx => tx.id !== id)
    if (selectedTextId.value === id) {
      selectedTextId.value = null
    }
    // Fall back to caption dragging when the last title (the drag target) is gone.
    if (!texts.value.length && dragTarget.value === 'title') {
      dragTarget.value = 'caption'
    }
    redraw()
    maybeReady()
  }

  function selectText(id) {
    selectedTextId.value = id
    selectedCueIndex.value = null
    // Title overlays are edited in the Style tab now (the Titles tab was removed).
    inspectorTab.value = 'style'
    // Focusing a title makes it the preview drag/resize target.
    dragTarget.value = 'title'
    const tx = texts.value.find(item => item.id === id)
    // Bring the title on screen so inspector edits are visible (WYSIWYG).
    if (tx && (scrub.value < tx.start || scrub.value >= tx.end)) {
      seek(tx.start)
    }
  }

  // ---- Watermark / logo -----------------------------------------------------
  async function loadLogo(file) {
    if (!file) {
      logoBitmap.value = null
      logoName.value = ''
      rawLogo = null
      redraw()
      return true
    }
    try {
      const bitmap = await bitmapFromBlob(file)
      logoBitmap.value = bitmap
      rawLogo = file
      logoName.value = file.name || 'logo'
      log(`Logo: ${file.name || 'logo'} ${bitmap.width}×${bitmap.height}.`)
    } catch (err) {
      logoBitmap.value = null
      log('Logo load failed: ' + (err?.message || err))
      return false
    } finally {
      redraw()
    }
    return true
  }

  // The logo's visibility window, shown as a single timeline clip. A full-span
  // logo keeps end at 0 until the user trims it; once trimmed it holds concrete
  // seconds. The clip's effective end falls back to the clip duration.
  const logoWindow = computed(() => {
    const dur = previewDuration.value
    const start = Math.max(0, Math.min(logo.start || 0, dur))
    const end = logo.end && logo.end > start ? Math.min(logo.end, dur) : dur
    return { start, end }
  })

  function setLogoTime(start, end) {
    const dur = previewDuration.value
    const MIN = 0.3
    const s = Math.max(0, Math.min(start, dur - MIN))
    const e = Math.min(dur, Math.max(end, s + MIN))
    logo.start = r3(s)
    // A window reaching the clip end collapses back to the "full" sentinel, so it
    // keeps spanning the video if a longer audio track is loaded later.
    logo.end = e >= dur - 1e-3 ? 0 : r3(e)
  }

  function dismissResult() {
    if (result.value?.url) {
      URL.revokeObjectURL(result.value.url)
    }
    result.value = null
    showProgress.value = false
  }

  async function loadDemo() {
    try {
      const [audioBlob, image, srt, logoBlob] = await Promise.all([
        fetch('/demo/sound.mp3').then(r => r.blob()),
        fetch('/demo/image.png').then(r => r.blob()),
        fetch('/demo/caption.srt').then(r => r.blob()),
        // The ztudio brand mark, set as the default watermark to showcase the feature.
        fetch('/logo.svg').then(r => r.blob()),
      ])
      // Audio first so the demo image clip can span the full known duration.
      await loadAudio(audioBlob)
      const logoFile = new File([logoBlob], 'ztudio-logo.svg', { type: 'image/svg+xml' })
      await Promise.all([addImages([image]), loadSrt(srt), loadLogo(logoFile)])
      // Seed a default title overlay so the Title track isn't empty on first run.
      if (!texts.value.length) {
        addText()
        selectedTextId.value = null
      }
      log('Loaded demo media.')
    } catch (err) {
      log('Could not load demo media: ' + (err?.message || err))
    }
  }

  // ---- Project autosave / resume --------------------------------------------
  // The serialisable project: edit state + which media is present (the bytes live
  // in IndexedDB under stable keys: 'audio', 'music', and 'img:<id>').
  function projectDoc() {
    return {
      v: 1,
      controls: { ...controls },
      audio: { ...audio },
      resolution: resolution.value,
      preset: preset.value,
      trimStart: trimStart.value,
      trimEnd: trimEnd.value,
      cues: cues.value.map(c => ({ ...c })),
      keyframes: keyframes.value.map(k => ({ ...k, values: { ...k.values } })),
      images: images.value.map(stripBitmap),
      texts: texts.value.map(tx => ({ ...tx })),
      exportSettings: { ...exportSettings },
      hasAudio: !!rawAudio,
      hasMusic: !!rawMusic,
      musicName: musicName.value,
      hasLogo: !!rawLogo,
      logo: { ...logo },
      logoName: logoName.value,
      selectedImageId: selectedImageId.value,
    }
  }

  // Write a blob only when it actually changed (ref compare), so large unchanged
  // media isn't rewritten on every keystroke-debounced save.
  async function syncBlob(key, blob) {
    if (persistedBlobs.get(key) === blob) {
      return
    }
    await putBlob(key, blob)
    persistedBlobs.set(key, blob)
  }

  async function saveProject() {
    autosaveStatus.value = 'saving'
    try {
      const desired = new Set()
      if (rawAudio) {
        await syncBlob('audio', rawAudio)
        desired.add('audio')
      }
      if (rawMusic) {
        await syncBlob('music', rawMusic)
        desired.add('music')
      }
      if (rawLogo) {
        await syncBlob('logo', rawLogo)
        desired.add('logo')
      }
      for (const im of images.value) {
        const blob = imageBlobs.get(im.id)
        if (blob) {
          const key = 'img:' + im.id
          await syncBlob(key, blob)
          desired.add(key)
        }
      }
      // Drop blobs no longer referenced (removed media / cleared clips).
      for (const key of await allBlobKeys()) {
        if (!desired.has(key)) {
          await deleteBlob(key)
          persistedBlobs.delete(key)
        }
      }
      await saveDoc(projectDoc())
      autosaveStatus.value = 'saved'
    } catch (err) {
      autosaveStatus.value = 'error'
      log('Autosave failed: ' + (err?.message || err))
    }
  }

  let saveTimer = null
  watch(
    () => [
      historyKey.value,
      audioBuffer.value,
      musicBuffer.value,
      musicName.value,
      logoBitmap.value,
      JSON.stringify(logo),
      JSON.stringify(exportSettings),
    ],
    () => {
      if (initializing || restoring) {
        return
      }
      if (saveTimer) {
        clearTimeout(saveTimer)
      }
      autosaveStatus.value = 'saving'
      saveTimer = setTimeout(() => {
        saveTimer = null
        saveProject()
      }, 1000)
    },
  )

  // Rehydrate a saved project: re-decode media from IndexedDB, then apply the doc.
  async function loadProject(doc) {
    restoring = true
    loadingKeyframe = true
    applyingPreset = true
    try {
      if (doc.hasAudio) {
        const blob = await getBlob('audio')
        if (blob) {
          audioBuffer.value = await decodeAudioFile(blob)
          rawAudio = blob
          persistedBlobs.set('audio', blob)
        }
      }
      if (doc.hasMusic) {
        const blob = await getBlob('music')
        if (blob) {
          musicBuffer.value = await decodeAudioFile(blob)
          rawMusic = blob
          musicName.value = doc.musicName || 'music'
          persistedBlobs.set('music', blob)
        }
      }
      if (doc.hasLogo) {
        const blob = await getBlob('logo')
        if (blob) {
          logoBitmap.value = await bitmapFromBlob(blob)
          rawLogo = blob
          logoName.value = doc.logoName || 'logo'
          persistedBlobs.set('logo', blob)
        }
      }
      const restored = []
      let maxId = 0
      for (const meta of doc.images || []) {
        try {
          const blob = await getBlob('img:' + meta.id)
          if (!blob) {
            continue
          }
          const bitmap = await createImageBitmap(blob)
          bitmapRegistry.set(meta.id, bitmap)
          imageBlobs.set(meta.id, blob)
          persistedBlobs.set('img:' + meta.id, blob)
          restored.push({ ...meta, bitmap })
          maxId = Math.max(maxId, meta.id)
        } catch (err) {
          log('Could not restore an image: ' + (err?.message || err))
        }
      }
      images.value = restored
      imageCounter = Math.max(imageCounter, maxId)

      cues.value = (doc.cues || []).map(c => ({ ...c }))
      keyframes.value = (doc.keyframes || []).map(k => ({ ...k, values: { ...k.values } }))
      kfCounter = keyframes.value.reduce((m, k) => Math.max(m, k.id), kfCounter)
      texts.value = (doc.texts || []).map(tx => ({ ...tx }))
      textCounter = texts.value.reduce((m, tx) => Math.max(m, tx.id), textCounter)
      selectedTextId.value = null
      Object.assign(controls, doc.controls || {})
      Object.assign(audio, doc.audio || {})
      Object.assign(logo, doc.logo || {})
      Object.assign(exportSettings, doc.exportSettings || {})
      resolution.value = doc.resolution || resolution.value
      preset.value = doc.preset || 'custom'
      trimStart.value = doc.trimStart ?? 0
      trimEnd.value = doc.trimEnd ?? (audioBuffer.value ? audioBuffer.value.duration : 0)
      selectedImageId.value = images.value.some(im => im.id === doc.selectedImageId)
        ? doc.selectedImageId
        : (images.value[0]?.id ?? null)
      selectedCueIndex.value = null
      if (!images.value.length) {
        dragTarget.value = 'caption'
      }
      log('Restored your last project.')
    } catch (err) {
      log('Restore failed: ' + (err?.message || err))
    } finally {
      nextTick(() => {
        restoring = false
        loadingKeyframe = false
        applyingPreset = false
      })
      scrub.value = 0
      redraw()
      maybeReady()
    }
  }

  async function restoreProject() {
    const doc = pendingRestore.value
    pendingRestore.value = null
    if (doc) {
      await loadProject(doc)
      saveProject()
    }
  }

  async function discardRestore() {
    pendingRestore.value = null
    initializing = true
    try {
      await idbClearProject()
      persistedBlobs.clear()
      await loadDemo()
    } finally {
      initializing = false
    }
  }

  async function init() {
    loadLayout()
    await ensureDefaultFonts()
    applyPreset('clean')
    await restoreCustomFonts()
    // Offer to resume a saved project; otherwise fall back to the demo.
    let saved = null
    try {
      saved = await loadDoc()
    } catch {
      /* persistence unavailable */
    }
    if (saved && (saved.hasAudio || (saved.images && saved.images.length))) {
      pendingRestore.value = saved
    } else {
      await loadDemo()
    }
    clampScrub()
    maybeReady()
    beginHistory()
    initializing = false
    await runEnvCheck()
  }

  return {
    logEntries,
    audioBuffer,
    images,
    selectedImageId,
    selectedImage,
    activeImage,
    hasImages,
    selectedImageHasCrop,
    cues,
    srtSpan,
    trimStart,
    trimEnd,
    trimWindow,
    outputDuration,
    outputDurationLabel,
    trimStartLabel,
    trimEndLabel,
    hasTrim,
    resolution,
    customFonts,
    preset,
    scrub,
    previewTick,
    timelineZoom,
    showShortcuts,
    exportDialog,
    openExportDialog,
    inspectorTab,
    snapEnabled,
    snapGuide,
    contextMenu,
    autosaveStatus,
    pendingRestore,
    restoreProject,
    discardRestore,
    selectedCueIndex,
    controls,
    busy,
    status,
    progress,
    showProgress,
    result,
    env,
    isPlaying,
    dimensions,
    previewDuration,
    currentCaption,
    canRender,
    fontOptions,
    progressPercent,
    sizeLabel,
    strokeLabel,
    lineHeightLabel,
    imageZoomLabel,
    timeLabel,
    style,
    audio,
    audioPill,
    musicPill,
    hasMusic,
    musicName,
    imagePill,
    srtPill,
    fontPill,
    logoPill,
    exportSettings,
    texts,
    selectedText,
    activeText,
    selectedTextId,
    hasTexts,
    addText,
    updateText,
    updateTextTime,
    setTextPos,
    removeText,
    selectText,
    setTextFont,
    hasLogo,
    logoName,
    logo,
    logoWindow,
    logoResolved,
    loadLogo,
    setLogoTime,
    redraw,
    dragTarget,
    setCaptionOffset,
    resetCaptionOffset,
    setImageZoom,
    setImageOffset,
    setImageRotation,
    setImageFit,
    setImageEffect,
    setImageCrop,
    setImageFade,
    resetImageTransform,
    resetImageCrop,
    addImages,
    clearImages,
    removeImage,
    selectImage,
    updateImageTime,
    setTrim,
    resetTrim,
    keyframes,
    selectedKeyframeId,
    hasKeyframes,
    addKeyframe,
    removeKeyframe,
    clearKeyframes,
    selectKeyframe,
    setKeyframeEasing,
    moveKeyframe,
    applyPreset,
    loadAudio,
    loadMusic,
    importFiles,
    loadSrt,
    loadFont,
    loadFonts,
    clearCustomFonts,
    render,
    cancel,
    exportThumbnail,
    play,
    pause,
    togglePlay,
    loopPlayback,
    previewVolume,
    muted,
    toggleMute,
    layout,
    setPanelSize,
    saveLayout,
    toggleMediaPanel,
    toggleInspectorPanel,
    seek,
    nudge,
    jumpCue,
    zoomTimeline,
    deleteSelected,
    snapEdge,
    snapClip,
    clearSnap,
    openContextMenu,
    closeContextMenu,
    splitImageAt,
    duplicateImage,
    splitCueAt,
    duplicateCue,
    updateCue,
    selectCue,
    goToCue,
    setCueText,
    addCue,
    addCaption,
    removeCue,
    captionDialog,
    openAddCaption,
    openEditCaption,
    closeCaptionDialog,
    dismissResult,
    canUndo,
    canRedo,
    undo,
    redo,
    init,
  }
})
