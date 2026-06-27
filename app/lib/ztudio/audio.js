// Client-side audio mixdown. Combines the voice (primary) track with an optional
// background-music bed into a single AudioBuffer covering the [from, to] window,
// applying per-track gain, fade in/out, music looping, and optional auto-ducking
// (lowering the music while the voice is talking). Rendered offline so the same
// mix that the user previews is what gets muxed into the export.

export const AUDIO_DEFAULTS = {
  voiceGain: 1,
  voiceFadeIn: 0,
  voiceFadeOut: 0,
  musicGain: 0.45,
  musicFadeIn: 1,
  musicFadeOut: 1.5,
  musicLoop: true,
  ducking: true,
  duckAmount: 0.75,
}

// Ducking envelope-follower constants.
const DUCK_THRESHOLD = 0.04 // voice peak above this counts as "talking"
const DUCK_ATTACK = 0.08 // seconds to dip the music when the voice starts
const DUCK_RELEASE = 0.35 // seconds to bring it back once the voice stops

const clampGain = g => (g < 0 ? 0 : g > 4 ? 4 : g)

// Peak amplitude of the voice over each output point, normalised to 0..1 against
// the talking threshold. Channel 0 is enough to track speech presence.
function voiceActivity(voice, from, dur, points) {
  const sr = voice.sampleRate
  const ch = voice.getChannelData(0)
  const start = Math.floor(from * sr)
  const span = (dur * sr) / points
  const act = new Float32Array(points)
  for (let i = 0; i < points; i++) {
    const s0 = start + Math.floor(i * span)
    const s1 = start + Math.floor((i + 1) * span)
    let peak = 0
    for (let s = s0; s < s1 && s < ch.length; s++) {
      const a = ch[s] < 0 ? -ch[s] : ch[s]
      if (a > peak) {
        peak = a
      }
    }
    act[i] = peak >= DUCK_THRESHOLD ? Math.min(1, peak / DUCK_THRESHOLD - 1) : 0
  }
  return act
}

// Per-point music multiplier (1 = full, 1-duckAmount = fully ducked), smoothed
// with separate attack/release so the music dips quickly under speech and eases
// back during pauses instead of pumping.
function duckMultiplier(voice, from, dur, points, duckAmount) {
  const act = voiceActivity(voice, from, dur, points)
  const dt = dur / points
  const mult = new Float32Array(points)
  let env = 0
  for (let i = 0; i < points; i++) {
    const target = act[i]
    const tau = target > env ? DUCK_ATTACK : DUCK_RELEASE
    const a = tau > 0 ? 1 - Math.exp(-dt / tau) : 1
    env += (target - env) * a
    mult[i] = 1 - duckAmount * env
  }
  return mult
}

// Build a gain automation curve: base gain shaped by fade in/out (linear) and an
// optional per-point multiplier (used for ducking).
function gainCurve(points, dur, baseGain, fadeIn, fadeOut, mult) {
  const curve = new Float32Array(points)
  const fi = Math.min(fadeIn, dur)
  const fo = Math.min(fadeOut, dur)
  for (let i = 0; i < points; i++) {
    const t = points > 1 ? (i / (points - 1)) * dur : 0
    let g = baseGain
    if (fi > 0 && t < fi) {
      g *= t / fi
    }
    if (fo > 0 && t > dur - fo) {
      g *= Math.max(0, (dur - t) / fo)
    }
    if (mult) {
      g *= mult[i]
    }
    curve[i] = g
  }
  return curve
}

// Render the final mixed track for [from, to]. Returns a new AudioBuffer whose
// time 0 maps to media time `from`, so callers can add it to the output stream at
// offset 0. Voice is required; music is optional.
export async function renderMix(opts) {
  const {
    voice,
    music = null,
    from = 0,
    to,
    voiceGain = 1,
    voiceFadeIn = 0,
    voiceFadeOut = 0,
    musicGain = 0.45,
    musicFadeIn = 0,
    musicFadeOut = 0,
    musicLoop = true,
    ducking = false,
    duckAmount = 0.75,
  } = opts

  const sr = voice.sampleRate
  const end = to != null ? to : voice.duration
  const dur = Math.max(0, end - from)
  const length = Math.max(1, Math.ceil(dur * sr))
  const channels = Math.max(voice.numberOfChannels, music ? music.numberOfChannels : 1)

  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
  const oac = new OAC(channels, length, sr)

  // ~20ms automation resolution, capped so very long tracks stay bounded.
  const points = Math.max(2, Math.min(20000, Math.ceil(dur / 0.02)))

  // Voice: gain + fades, played from the trim start for the window length.
  const vSrc = oac.createBufferSource()
  vSrc.buffer = voice
  const vGain = oac.createGain()
  vGain.gain.setValueCurveAtTime(
    gainCurve(points, dur, clampGain(voiceGain), voiceFadeIn, voiceFadeOut, null),
    0,
    dur,
  )
  vSrc.connect(vGain).connect(oac.destination)
  vSrc.start(0, from, dur)

  // Music bed: gain + fades, optional loop, optional ducking under the voice.
  // The offline render length truncates anything past the window, so a looped or
  // over-long bed is cut to fit automatically.
  if (music) {
    const mSrc = oac.createBufferSource()
    mSrc.buffer = music
    mSrc.loop = musicLoop
    const mGain = oac.createGain()
    const mult = ducking ? duckMultiplier(voice, from, dur, points, duckAmount) : null
    mGain.gain.setValueCurveAtTime(
      gainCurve(points, dur, clampGain(musicGain), musicFadeIn, musicFadeOut, mult),
      0,
      dur,
    )
    mSrc.connect(mGain).connect(oac.destination)
    mSrc.start(0)
  }

  return await oac.startRendering()
}
