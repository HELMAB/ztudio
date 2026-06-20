import { MR_TYPES } from './config'
import { buildSegments } from './segments'
import { drawFrame } from './renderer'

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

export async function pickPipeline(MB, width, height) {
  if (!MB) {
    return { error: 'WebCodecs library not loaded.' }
  }

  const {
    Mp4OutputFormat,
    WebMOutputFormat,
    getFirstEncodableVideoCodec,
    getFirstEncodableAudioCodec,
  } = MB

  const mp4 = new Mp4OutputFormat()
  const v = await getFirstEncodableVideoCodec(mp4.getSupportedVideoCodecs(), { width, height })
  const a = await getFirstEncodableAudioCodec(mp4.getSupportedAudioCodecs())
  if (v && a) {
    return { format: mp4, videoCodec: v, audioCodec: a, label: `MP4 (${v} + ${a})`, ext: 'mp4' }
  }

  const webm = new WebMOutputFormat()
  const v2 = await getFirstEncodableVideoCodec(webm.getSupportedVideoCodecs(), { width, height })
  const a2 = await getFirstEncodableAudioCodec(webm.getSupportedAudioCodecs())
  if (v2 && a2) {
    return {
      format: webm,
      videoCodec: v2,
      audioCodec: a2,
      label: `WebM (${v2} + ${a2}) — MP4 unavailable`,
      ext: 'webm',
      fallback: true,
    }
  }

  return { error: 'No WebCodecs video+audio codec combination.' }
}

export async function generateFast(MB, pipe, w, h, dur, ctx2) {
  const {
    audioBuffer,
    cues,
    style,
    imageBitmap,
    imageFit,
    onProgress,
    onStatus,
    log,
    isCancelled,
  } = ctx2
  const { Output, BufferTarget, CanvasSource, AudioBufferSource, QUALITY_HIGH } = MB

  const output = new Output({ format: pipe.format, target: new BufferTarget() })
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })

  const videoSource = new CanvasSource(canvas, { codec: pipe.videoCodec, bitrate: QUALITY_HIGH })
  output.addVideoTrack(videoSource)
  const audioSource = new AudioBufferSource({ codec: pipe.audioCodec, bitrate: QUALITY_HIGH })
  output.addAudioTrack(audioSource)
  await output.start()

  const segs = buildSegments(cues, dur, style.animation, style.animDuration)
  log(`Frames: ${segs.length} (vs ${Math.ceil(dur * 30)} at naive 30fps).`)
  const t0 = performance.now()

  for (let i = 0; i < segs.length; i++) {
    if (isCancelled()) {
      return null
    }
    drawFrame(ctx, w, h, segs[i].start, { imageBitmap, imageFit, cues, style })
    await videoSource.add(segs[i].start, segs[i].dur)
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
  await audioSource.add(audioBuffer)
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
    audioBuffer,
    cues,
    style,
    imageBitmap,
    imageFit,
    onProgress,
    onStatus,
    log,
    isCancelled,
  } = ctx2

  const mimeType = mrType()
  if (!mimeType) {
    throw new Error('MediaRecorder has no usable codec here.')
  }
  const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  drawFrame(ctx, w, h, 0, { imageBitmap, imageFit, cues, style })

  const AC = window.AudioContext || window.webkitAudioContext
  const ac = new AC()
  await ac.resume()
  const src = ac.createBufferSource()
  src.buffer = audioBuffer
  const dest = ac.createMediaStreamDestination()
  src.connect(dest)

  const vstream = canvas.captureStream(30)
  const stream = new MediaStream([...vstream.getVideoTracks(), ...dest.stream.getAudioTracks()])
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
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
  src.start()
  log('Recording in real time…')

  await new Promise(res => {
    function tick() {
      const elapsed = ac.currentTime - startAt
      if (isCancelled() || elapsed >= dur) {
        res()
        return
      }
      drawFrame(ctx, w, h, Math.min(elapsed, dur), { imageBitmap, imageFit, cues, style })
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
