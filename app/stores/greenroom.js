import { defineStore } from 'pinia'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { DEFAULT_STYLE, KHMER_FONT, MAX_AUDIO_SEC, PRESETS } from '@/lib/greenroom/config'
import { captionAt, parseSRT } from '@/lib/greenroom/srt'
import {
  decodeAudioFile,
  generateFast,
  generateRealtime,
  loadMediabunny,
  mrType,
  pickPipeline,
} from '@/lib/greenroom/encoder'
import { useActivityLog } from '@/composables/useActivityLog'

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const buildFontStack = sel =>
  sel === 'default' ? KHMER_FONT : `"${sel}", "Noto Sans Khmer", system-ui, sans-serif`

export const useGreenroomStore = defineStore('greenroom', () => {
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
    box: false,
    imageFit: 'contain',
  })

  const busy = ref(false)
  const status = ref('Add audio to start.')
  const progress = ref(0)
  const showProgress = ref(false)
  const result = ref(null)
  const env = ref({ level: 'pending', title: 'Checking encoder support…', note: '' })
  const isPlaying = ref(false)

  let cancelRequested = false
  let applyingPreset = false
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
  const canRender = computed(() => !!audioBuffer.value && !busy.value)
  const fontOptions = computed(() => [
    { value: 'default', label: 'Noto Sans Khmer' },
    ...customFonts.value,
  ])
  const progressPercent = computed(() => Math.round(progress.value * 100))
  const sizeLabel = computed(() => (controls.fontSizePct * 100).toFixed(1) + '%')
  const strokeLabel = computed(() => Math.round(controls.strokePct * 100) + '%')
  const timeLabel = computed(() => scrub.value.toFixed(1) + 's')

  const style = computed(() => ({
    ...DEFAULT_STYLE,
    fontFamily: buildFontStack(controls.fontKey),
    fontSizePct: controls.fontSizePct,
    fontWeight: controls.fontWeight,
    fill: controls.fill,
    strokeColor: controls.strokeColor,
    strokePct: controls.strokePct,
    position: controls.position,
    box: controls.box,
  }))

  const audioPill = computed(() =>
    audioBuffer.value
      ? { ok: true, text: `audio ${fmt(audioBuffer.value.duration)}` }
      : { ok: false, text: 'no audio' },
  )
  const imagePill = computed(() =>
    imageBitmap.value
      ? { ok: true, text: `image ${imageBitmap.value.width}×${imageBitmap.value.height}` }
      : { ok: false, text: 'no image' },
  )
  const srtPill = computed(() =>
    cues.value.length
      ? { ok: true, text: `${cues.value.length} cues` }
      : { ok: false, text: 'no captions' },
  )

  function redraw() {
    previewTick.value++
  }

  function clampScrub() {
    if (scrub.value > previewDuration.value) {
      scrub.value = 0
    }
  }

  function maybeReady() {
    if (audioBuffer.value && !busy.value) {
      status.value = 'Ready to render.'
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
      controls.box,
    ],
    () => {
      if (!applyingPreset) {
        preset.value = 'custom'
      }
      redraw()
    },
  )

  watch(() => [controls.fontKey, controls.imageFit, resolution.value], redraw)

  async function loadAudio(file) {
    if (!file) {
      audioBuffer.value = null
      maybeReady()
      return true
    }
    status.value = 'Decoding audio…'
    try {
      const buf = await decodeAudioFile(file)
      if (buf.duration > MAX_AUDIO_SEC) {
        audioBuffer.value = null
        status.value = `That track is ${fmt(buf.duration)} — over the 5:00 limit. Trim it and try again.`
        log(`Rejected audio: ${buf.duration.toFixed(1)}s`)
        return false
      }
      audioBuffer.value = buf
      log(`Audio: ${buf.duration.toFixed(2)}s, ${buf.numberOfChannels}ch, ${buf.sampleRate}Hz`)
    } catch (err) {
      audioBuffer.value = null
      status.value = 'That audio file could not be decoded. Try MP3, WAV, or M4A.'
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
    if (file) {
      log(`Image: ${imageBitmap.value.width}×${imageBitmap.value.height}`)
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
      status.value = 'No cues found in that .srt — check the timestamp format.'
    }
    clampScrub()
    redraw()
    maybeReady()
  }

  async function loadFont(file) {
    if (!file) {
      return
    }
    status.value = 'Loading font…'
    try {
      const ff = new FontFace('UserFont' + ++fontCounter, await file.arrayBuffer())
      await ff.load()
      document.fonts.add(ff)
      customFonts.value.push({ value: ff.family, label: file.name })
      controls.fontKey = ff.family
      redraw()
      log(`Loaded font "${file.name}" as ${ff.family}.`)
      status.value = audioBuffer.value ? 'Ready to render.' : 'Font loaded.'
    } catch (err) {
      log('Font upload failed: ' + (err?.message || err))
      status.value = 'That font file could not be loaded.'
    }
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
      env.value = {
        level: r.fallback ? 'warn' : 'good',
        title: `Fast encode — ${r.label}`,
        note: r.fallback
          ? 'AAC/H.264 unavailable here (expected on Firefox and desktop Linux); fast WebCodecs WebM will be used. Use Chrome or Edge for MP4.'
          : 'Full MP4 (H.264 + AAC) via WebCodecs — encodes faster than realtime.',
      }
    } else if (mr) {
      env.value = {
        level: 'warn',
        title: `Realtime fallback — ${mr.startsWith('video/mp4') ? 'MP4' : 'WebM'} (MediaRecorder)`,
        note: 'No WebCodecs encoder here, so a realtime fallback will run — it takes as long as the audio. For fast MP4, use desktop Chrome or Edge.',
      }
    } else {
      env.value = {
        level: 'bad',
        title: 'No encoder available in this browser.',
        note: 'Neither WebCodecs nor MediaRecorder can encode here. Use desktop Chrome or Edge.',
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
    status.value = 'Rendered.'
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
        onProgress: p => {
          progress.value = p
        },
        onStatus: m => {
          status.value = m
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
        status.value = 'Stopped.'
        log('Generation cancelled.')
        return
      }
      log(`Done in ${res.secs.toFixed(2)}s (${res.ratio.toFixed(1)}× realtime).`)
      presentResult(res, dur)
    } catch (err) {
      console.error(err)
      log('ERROR: ' + (err?.message || err))
      status.value = 'Render failed — see activity log.'
    } finally {
      busy.value = false
      maybeReady()
    }
  }

  function cancel() {
    cancelRequested = true
    status.value = 'Stopping…'
    log('Cancel requested.')
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
    timeLabel,
    style,
    audioPill,
    imagePill,
    srtPill,
    redraw,
    applyPreset,
    loadAudio,
    loadImage,
    loadSrt,
    loadFont,
    render,
    cancel,
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
