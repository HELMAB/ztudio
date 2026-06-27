import { defineStore } from 'pinia'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { DEFAULT_STYLE, KHMER_FONT, MAX_AUDIO_SEC, PRESETS } from '@/lib/ztudio/config'
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
import { useActivityLog } from '@/composables/useActivityLog'

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const buildFontStack = sel =>
  sel === 'default' ? KHMER_FONT : `"${sel}", "Noto Sans Khmer", system-ui, sans-serif`

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
    highlightWord: false,
    highlightColor: '#00e0a4',
    highlightStyle: 'text',
    position: 'bottom',
    offsetXPct: 0,
    offsetYPct: 0,
    box: false,
    animation: 'blur',
    overlay: 'none',
    overlayIntensity: 1,
    transition: 'none',
    transitionDuration: 0.5,
  })

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
  let playRaf = null
  let playCtx = null
  let playSource = null
  let playMusicSource = null
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
  }))

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

  function resetImageTransform() {
    const im = selectedImage.value
    if (im) {
      im.zoom = 1
      im.offsetXPct = 0
      im.offsetYPct = 0
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
      trimStart: trimStart.value,
      trimEnd: trimEnd.value,
      resolution: resolution.value,
      preset: preset.value,
      selectedImageId: selectedImageId.value,
      selectedCueIndex: selectedCueIndex.value,
      selectedKeyframeId: selectedKeyframeId.value,
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
      cropTop: 0,
      cropBottom: 0,
      cropLeft: 0,
      cropRight: 0,
      effect: 'vivid',
    }
    bitmapRegistry.set(clip.id, bitmap)
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
    selectedImageId.value = null
    dragTarget.value = 'caption'
    redraw()
    maybeReady()
  }

  function removeImage(id) {
    images.value = images.value.filter(im => im.id !== id)
    if (selectedImageId.value === id) {
      selectedImageId.value = images.value.length ? images.value[0].id : null
    }
    if (!images.value.length) {
      dragTarget.value = 'caption'
    }
    redraw()
    maybeReady()
  }

  function selectImage(id) {
    selectedImageId.value = id
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

  async function render() {
    if (busy.value || !audioBuffer.value) {
      return
    }
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
      const pipe = await pickPipeline(MB, w, h)

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
    playSource = null
    playMusicSource = null
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

      // Voice through a gain node so the preview reflects the mix level. Fades and
      // ducking are render-time shaping (they depend on the absolute window) and
      // are not reproduced here, where playback can start at any scrubbed point.
      playSource = ctx.createBufferSource()
      playSource.buffer = audioBuffer.value
      const voiceGain = ctx.createGain()
      voiceGain.gain.value = audio.voiceGain
      playSource.connect(voiceGain).connect(ctx.destination)
      playSource.start(0, playStartOffset)

      // Background-music bed, aligned to the timeline so it stays in sync with the
      // voice as you scrub: offset into the loop by how far past `from` we start.
      if (musicBuffer.value) {
        const m = ctx.createBufferSource()
        m.buffer = musicBuffer.value
        m.loop = audio.musicLoop
        const mGain = ctx.createGain()
        mGain.gain.value = audio.musicGain
        m.connect(mGain).connect(ctx.destination)
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

  function seek(t) {
    pause()
    scrub.value = Math.min(Math.max(t, 0), previewDuration.value)
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
  }

  function setCueText(index, text) {
    const cue = cues.value[index]
    if (!cue) {
      return
    }
    cue.text = text
    redraw()
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

  function dismissResult() {
    if (result.value?.url) {
      URL.revokeObjectURL(result.value.url)
    }
    result.value = null
    showProgress.value = false
  }

  async function loadDemo() {
    try {
      const [audioBlob, image, srt] = await Promise.all([
        fetch('/demo/sound.mp3').then(r => r.blob()),
        fetch('/demo/image.png').then(r => r.blob()),
        fetch('/demo/caption.srt').then(r => r.blob()),
      ])
      // Audio first so the demo image clip can span the full known duration.
      await loadAudio(audioBlob)
      await Promise.all([addImages([image]), loadSrt(srt)])
      log('Loaded demo media.')
    } catch (err) {
      log('Could not load demo media: ' + (err?.message || err))
    }
  }

  async function init() {
    await ensureDefaultFonts()
    applyPreset('clean')
    await restoreCustomFonts()
    await loadDemo()
    clampScrub()
    maybeReady()
    beginHistory()
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
    redraw,
    dragTarget,
    setCaptionOffset,
    resetCaptionOffset,
    setImageZoom,
    setImageOffset,
    setImageFit,
    setImageEffect,
    setImageCrop,
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
    seek,
    updateCue,
    selectCue,
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
