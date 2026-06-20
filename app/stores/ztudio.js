import { defineStore } from 'pinia'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { DEFAULT_STYLE, KHMER_FONT, MAX_AUDIO_SEC, PRESETS } from '@/lib/ztudio/config'
import { KHMER_FONTS } from '@/lib/ztudio/khmer-fonts'
import { captionAt, parseSRT } from '@/lib/ztudio/srt'
import { drawFrame } from '@/lib/ztudio/renderer'
import { ANIMATED_FIELDS, DEFAULT_EASING, keyframeValues } from '@/lib/ztudio/keyframes'
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
  const imageBitmap = ref(null)
  const cues = ref([])
  const srtSpan = computed(() => (cues.value.length ? Math.max(...cues.value.map(c => c.end)) : 0))

  const resolution = ref('1080x1920')
  const customFonts = ref([])
  const preset = ref('clean')
  const scrub = ref(0)
  const previewTick = ref(0)
  const selectedCueIndex = ref(null)

  const controls = reactive({
    fontKey: 'default',
    fontSizePct: 0.055,
    fontWeight: '700',
    fill: '#ffffff',
    strokeColor: '#000000',
    strokePct: 0.16,
    position: 'bottom',
    offsetXPct: 0,
    offsetYPct: 0,
    box: false,
    imageFit: 'contain',
    imageZoom: 1,
    imageOffsetXPct: 0,
    imageOffsetYPct: 0,
    animation: 'none',
  })

  // What canvas-drag on the preview repositions: 'caption' or 'image'.
  const dragTarget = ref('caption')

  // Keyframes animate the ANIMATED_FIELDS over time. Each is a snapshot of those
  // fields at a time t with an easing for the transition into it. Kept sorted.
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
  let kfCounter = 0
  let fontCounter = 0
  let playRaf = null
  let playCtx = null
  let playSource = null
  let playStartClock = 0
  let playStartOffset = 0

  const dimensions = computed(() => {
    const [w, h] = resolution.value.split('x').map(Number)
    return { w, h }
  })
  const previewDuration = computed(() =>
    audioBuffer.value ? audioBuffer.value.duration : Math.max(10, srtSpan.value),
  )
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
  const imageZoomLabel = computed(() => Math.round(controls.imageZoom * 100) + '%')
  const timeLabel = computed(() => scrub.value.toFixed(1) + 's')

  const style = computed(() => ({
    ...DEFAULT_STYLE,
    fontFamily: buildFontStack(controls.fontKey),
    imageZoom: controls.imageZoom,
    imageOffsetXPct: controls.imageOffsetXPct,
    imageOffsetYPct: controls.imageOffsetYPct,
    fontSizePct: controls.fontSizePct,
    fontWeight: controls.fontWeight,
    fill: controls.fill,
    strokeColor: controls.strokeColor,
    strokePct: controls.strokePct,
    position: controls.position,
    offsetXPct: controls.offsetXPct,
    offsetYPct: controls.offsetYPct,
    box: controls.box,
    animation: controls.animation,
  }))

  const audioPill = computed(() =>
    audioBuffer.value
      ? { ok: true, text: t('pill.audio', { time: fmt(audioBuffer.value.duration) }) }
      : { ok: false, text: t('pill.noAudio') },
  )
  const imagePill = computed(() =>
    imageBitmap.value
      ? {
          ok: true,
          text: t('pill.image', {
            dimensions: `${imageBitmap.value.width}×${imageBitmap.value.height}`,
          }),
        }
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

  const clampOffset = v => (v < -0.5 ? -0.5 : v > 0.5 ? 0.5 : v)

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

  function setImageZoom(z) {
    controls.imageZoom = clampZoom(z)
  }

  function setImageOffset(xPct, yPct) {
    controls.imageOffsetXPct = clampPan(xPct)
    controls.imageOffsetYPct = clampPan(yPct)
  }

  function resetImageTransform() {
    controls.imageZoom = 1
    setImageOffset(0, 0)
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

  watch(() => controls.fontKey, key => ensureBundledFont(key).then(redraw))
  watch(
    () => [
      controls.imageFit,
      controls.imageZoom,
      controls.imageOffsetXPct,
      controls.imageOffsetYPct,
      controls.animation,
      resolution.value,
    ],
    redraw,
  )

  function animatedSnapshot() {
    const values = {}
    for (const field of ANIMATED_FIELDS) {
      values[field] = controls[field]
    }
    return values
  }

  // Editing an animated control while keyframes exist commits the change to a
  // keyframe at the current playhead (auto-key). Skipped while syncing from a
  // keyframe (below) so loading a frame's values never spawns a stray keyframe.
  watch(
    () => ANIMATED_FIELDS.map(field => controls[field]),
    () => {
      if (loadingKeyframe || !keyframes.value.length) {
        return
      }
      upsertKeyframeAt(scrub.value)
    },
  )

  // Scrubbing mirrors the interpolated values back into controls so the panel,
  // sliders, and drag handles reflect the frame under the playhead.
  watch(
    () => scrub.value,
    t => {
      if (!keyframes.value.length) {
        return
      }
      const values = keyframeValues(keyframes.value, t)
      loadingKeyframe = true
      Object.assign(controls, values)
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

  async function loadAudio(file) {
    if (!file) {
      audioBuffer.value = null
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

  async function loadImage(file) {
    imageBitmap.value = file ? await createImageBitmap(file) : null
    resetImageTransform()
    if (file) {
      log(`Image: ${imageBitmap.value.width}×${imageBitmap.value.height}`)
    } else {
      dragTarget.value = 'caption'
    }
    redraw()
    maybeReady()
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
      const dur = audioBuffer.value.duration
      const MB = await loadMediabunny(log)
      const pipe = await pickPipeline(MB, w, h)

      const renderCtx = {
        audioBuffer: audioBuffer.value,
        cues: cues.value,
        style: style.value,
        imageBitmap: imageBitmap.value,
        imageFit: controls.imageFit,
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
        if (srtSpan.value > dur + 0.05) {
          log(
            `Note: captions run to ${srtSpan.value.toFixed(1)}s but audio is ${dur.toFixed(1)}s; trailing captions cut.`,
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
        imageBitmap: imageBitmap.value,
        imageFit: controls.imageFit,
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

  function stopPlaybackAudio() {
    if (playSource) {
      try {
        playSource.stop()
      } catch {
        /* already stopped */
      }
      playSource = null
    }
    if (playCtx) {
      playCtx.close().catch(() => {})
      playCtx = null
    }
  }

  function pause() {
    if (playRaf) {
      cancelAnimationFrame(playRaf)
      playRaf = null
    }
    stopPlaybackAudio()
    isPlaying.value = false
  }

  function play() {
    if (isPlaying.value) {
      return
    }
    const dur = previewDuration.value
    if (scrub.value >= dur) {
      scrub.value = 0
    }
    isPlaying.value = true
    playStartOffset = scrub.value

    if (audioBuffer.value) {
      const AC = window.AudioContext || window.webkitAudioContext
      playCtx = new AC()
      playSource = playCtx.createBufferSource()
      playSource.buffer = audioBuffer.value
      playSource.connect(playCtx.destination)
      playSource.start(0, playStartOffset)
      playStartClock = playCtx.currentTime
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

  async function init() {
    await ensureDefaultFonts()
    applyPreset('clean')
    await restoreCustomFonts()
    clampScrub()
    maybeReady()
    await runEnvCheck()
  }

  return {
    logEntries,
    audioBuffer,
    imageBitmap,
    cues,
    srtSpan,
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
    imageZoomLabel,
    timeLabel,
    style,
    audioPill,
    imagePill,
    srtPill,
    fontPill,
    redraw,
    dragTarget,
    setCaptionOffset,
    resetCaptionOffset,
    setImageZoom,
    setImageOffset,
    resetImageTransform,
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
    loadImage,
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
    removeCue,
    dismissResult,
    init,
  }
})
