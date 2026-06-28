import { MR_TYPES } from './config'
import { buildSegments } from './segments'
import { drawFrame } from './renderer'
import { isOverlayActive } from './overlays'

let mediabunnyPromise = null

export function loadMediabunny(log) {
  if (!mediabunnyPromise) {
    mediabunnyPromise = (async () => {
      try {
        const mb = await import(/* @vite-ignore */ 'https://esm.sh/mediabunny')
        log?.('Loaded mediabunny from esm.sh')
        return mb
      } catch {
        try {
          const mb = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mediabunny/+esm')
          log?.('Loaded mediabunny from jsDelivr')
          return mb
        } catch (e2) {
          log?.(
            'WebCodecs library unavailable (CDN blocked); realtime fallback may still work. ' + e2,
          )
          return null
        }
      }
    })()
  }
  return mediabunnyPromise
}

export const mrType = () =>
  typeof window !== 'undefined' && window.MediaRecorder
    ? MR_TYPES.find(t => MediaRecorder.isTypeSupported(t))
    : null

export async function decodeAudioFile(file) {
  const arr = await file.arrayBuffer()
  const AC = window.AudioContext || window.webkitAudioContext
  const ac = new AC()
  try {
    return await ac.decodeAudioData(arr)
  } finally {
    ac.close()
  }
}

// Copy the samples in [from, to] (seconds) into a new, shorter AudioBuffer.
// Returns the original buffer untouched when the window already spans it.
export function sliceAudioBuffer(buffer, from, to) {
  const sr = buffer.sampleRate
  const startSample = Math.max(0, Math.floor(from * sr))
  const endSample = Math.min(buffer.length, Math.ceil(to * sr))
  const len = endSample - startSample
  if (len <= 0 || (startSample === 0 && endSample === buffer.length)) {
    return buffer
  }
  const out = new AudioBuffer({
    length: len,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: sr,
  })
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    out.copyToChannel(buffer.getChannelData(ch).subarray(startSample, endSample), ch, 0)
  }
  return out
}

// `prefer` controls container choice: 'auto' tries MP4 then WebM; 'mp4' forces
// MP4 (still falling back to WebM if MP4 can't encode here); 'webm' forces WebM.
export async function pickPipeline(MB, width, height, prefer = 'auto') {
  if (!MB) {
    return { error: 'WebCodecs library not loaded.' }
  }

  const {
    Mp4OutputFormat,
    WebMOutputFormat,
    getFirstEncodableVideoCodec,
    getFirstEncodableAudioCodec,
  } = MB

  if (prefer !== 'webm') {
    const mp4 = new Mp4OutputFormat()
    const v = await getFirstEncodableVideoCodec(mp4.getSupportedVideoCodecs(), { width, height })
    const a = await getFirstEncodableAudioCodec(mp4.getSupportedAudioCodecs())
    if (v && a) {
      return { format: mp4, videoCodec: v, audioCodec: a, label: `MP4 (${v} + ${a})`, ext: 'mp4' }
    }
  }

  const webm = new WebMOutputFormat()
  const v2 = await getFirstEncodableVideoCodec(webm.getSupportedVideoCodecs(), { width, height })
  const a2 = await getFirstEncodableAudioCodec(webm.getSupportedAudioCodecs())
  if (v2 && a2) {
    // Forced/auto WebM isn't a "fallback"; only flag it when MP4 was wanted.
    const fellBack = prefer !== 'webm'
    return {
      format: webm,
      videoCodec: v2,
      audioCodec: a2,
      label: fellBack ? `WebM (${v2} + ${a2}) — MP4 unavailable` : `WebM (${v2} + ${a2})`,
      ext: 'webm',
      fallback: fellBack,
    }
  }

  return { error: 'No WebCodecs video+audio codec combination.' }
}

export async function generateFast(MB, pipe, w, h, dur, ctx2) {
  const {
    mixedAudio,
    cues,
    style,
    images,
    keyframes,
    texts,
    logo,
    onProgress,
    onStatus,
    log,
    isCancelled,
  } = ctx2
  // Trim window in absolute media time; defaults to the whole clip.
  const from = ctx2.from || 0
  const to = ctx2.to != null ? ctx2.to : from + dur
  const fps = ctx2.fps || 30
  const { Output, BufferTarget, CanvasSource, AudioBufferSource } = MB
  // Resolve the requested quality to a mediabunny constant, defaulting to high.
  const bitrate = MB[ctx2.qualityKey] ?? MB.QUALITY_HIGH

  const output = new Output({ format: pipe.format, target: new BufferTarget() })
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })

  const videoSource = new CanvasSource(canvas, { codec: pipe.videoCodec, bitrate })
  output.addVideoTrack(videoSource)
  const audioSource = new AudioBufferSource({ codec: pipe.audioCodec, bitrate })
  output.addAudioTrack(audioSource)
  await output.start()

  // Per-clip fade windows need dense frames so the opacity ramps smoothly.
  const fadeWindows = []
  for (const im of images || []) {
    if (im.fadeIn) {
      fadeWindows.push({ start: im.start, end: im.start + im.fadeIn })
    }
    if (im.fadeOut) {
      fadeWindows.push({ start: im.end - im.fadeOut, end: im.end })
    }
  }

  const segs = buildSegments(
    cues,
    from,
    to,
    style.animation,
    style.animDuration,
    (keyframes || []).map(k => k.t),
    // Image cuts plus title-overlay show/hide boundaries all land on a frame.
    [
      ...(images || []).flatMap(im => [im.start, im.end]),
      ...(texts || []).flatMap(tx => [tx.start, tx.end]),
    ],
    isOverlayActive(style.overlay),
    style.highlightWord,
    style.transition && style.transition !== 'none' ? style.transitionDuration || 0 : 0,
    (images || []).map(im => im.start),
    fadeWindows,
    1 / fps,
  )
  log(`Frames: ${segs.length} (vs ${Math.ceil(dur * fps)} at naive ${fps}fps).`)
  const t0 = performance.now()

  for (let i = 0; i < segs.length; i++) {
    if (isCancelled()) {
      return null
    }
    // Draw at absolute media time; emit at output time (offset by the trim start).
    drawFrame(ctx, w, h, segs[i].start, { images, cues, style, keyframes, texts, logo })
    await videoSource.add(segs[i].start - from, segs[i].dur)
    if (i % 4 === 0) {
      onProgress(i / segs.length)
      onStatus(`Rendering frame ${i + 1}/${segs.length}…`)
      await new Promise(r => setTimeout(r))
    }
  }

  if (isCancelled()) {
    return null
  }

  onStatus('Adding audio…')
  // mixedAudio already spans [from, to] with voice+music mixed down.
  await audioSource.add(mixedAudio)
  onStatus('Finalizing…')
  await output.finalize()

  const secs = (performance.now() - t0) / 1000
  return {
    blob: new Blob([output.target.buffer], { type: output.format.mimeType }),
    ext: pipe.ext,
    label: pipe.label,
    frames: segs.length,
    secs,
    ratio: dur / secs,
  }
}

export async function generateRealtime(w, h, dur, ctx2) {
  const {
    mixedAudio,
    cues,
    style,
    images,
    keyframes,
    texts,
    logo,
    onProgress,
    onStatus,
    log,
    isCancelled,
  } = ctx2

  const from = ctx2.from || 0
  const fps = ctx2.fps || 30
  const videoBitsPerSecond = ctx2.mrBitrate || 8_000_000

  const mimeType = mrType()
  if (!mimeType) {
    throw new Error('MediaRecorder has no usable codec here.')
  }
  const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  drawFrame(ctx, w, h, from, { images, cues, style, keyframes, texts, logo })

  const AC = window.AudioContext || window.webkitAudioContext
  const ac = new AC()
  await ac.resume()
  const src = ac.createBufferSource()
  // mixedAudio already spans [from, to], so it plays from its own time 0.
  src.buffer = mixedAudio
  const dest = ac.createMediaStreamDestination()
  src.connect(dest)

  const vstream = canvas.captureStream(fps)
  const stream = new MediaStream([...vstream.getVideoTracks(), ...dest.stream.getAudioTracks()])
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })
  const chunks = []
  rec.ondataavailable = e => {
    if (e.data && e.data.size) {
      chunks.push(e.data)
    }
  }
  const stopped = new Promise((res, rej) => {
    rec.onstop = () => res()
    rec.onerror = ev => rej(ev.error || new Error('MediaRecorder error'))
  })

  const t0 = performance.now()
  rec.start(100)
  const startAt = ac.currentTime
  src.start(0, 0, dur)
  log('Recording in real time…')

  await new Promise(res => {
    function tick() {
      const elapsed = ac.currentTime - startAt
      if (isCancelled() || elapsed >= dur) {
        res()
        return
      }
      drawFrame(ctx, w, h, from + Math.min(elapsed, dur), {
        images,
        cues,
        style,
        keyframes,
        texts,
        logo,
      })
      onProgress(Math.min(1, elapsed / dur))
      onStatus(`Recording in real time… ${elapsed.toFixed(1)} / ${dur.toFixed(1)}s`)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  try {
    src.stop()
  } catch {
    /* already stopped */
  }
  if (rec.state !== 'inactive') {
    rec.stop()
  }
  await stopped
  ac.close()

  if (isCancelled()) {
    return null
  }

  const secs = (performance.now() - t0) / 1000
  return {
    blob: new Blob(chunks, { type: mimeType }),
    ext,
    label: `Realtime ${ext.toUpperCase()} (MediaRecorder)`,
    frames: null,
    secs,
    ratio: dur / secs,
  }
}
