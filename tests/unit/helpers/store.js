import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

// The store reaches for two Nuxt-injected globals (useNuxtApp for $i18n) and a few
// browser APIs. Install lightweight stand-ins so the store can be instantiated and
// its feature logic exercised in plain Node, without a real browser or i18n.
export function installStoreGlobals() {
  // i18n: echo the key so tests can assert which key was used.
  globalThis.useNuxtApp = () => ({ $i18n: { t: (key, params) => (params ? `${key}` : key) } })

  // createImageBitmap: return a bitmap-like with the dimensions carried on the file
  // stub (defaults to 1920x1080) so image-clip logic has real numbers.
  globalThis.createImageBitmap = vi.fn(async file => ({
    width: file?._w ?? 1920,
    height: file?._h ?? 1080,
    close() {},
  }))
}

// A fake decoded clip with the given duration, shaped like an AudioBuffer enough
// for the store (duration, channels, sampleRate, getChannelData).
export function fakeAudioBuffer(duration = 10, sampleRate = 48000, channels = 2) {
  const length = Math.ceil(duration * sampleRate)
  return {
    duration,
    length,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: () => new Float32Array(0),
  }
}

// A File-like that decodes (via the stubbed AudioContext) to a buffer of `duration`.
export function audioFile(duration = 10) {
  return { name: 'voice.mp3', _duration: duration, arrayBuffer: async () => new ArrayBuffer(8) }
}

// An image File-like carrying intended bitmap dimensions for createImageBitmap.
export function imageFile(name = 'pic.png', w = 1920, h = 1080) {
  return { name, _w: w, _h: h, arrayBuffer: async () => new ArrayBuffer(8) }
}

// Stub window.AudioContext so loadAudio's decodeAudioFile resolves to a fake buffer
// whose duration is read from the file stub.
export function stubAudioContext() {
  class FakeAudioContext {
    async decodeAudioData() {
      const dur = this._pendingDuration ?? 10
      return fakeAudioBuffer(dur)
    }
    close() {}
  }
  // decodeAudioFile calls new AC().decodeAudioData(arrayBuffer); we can't see the
  // file there, so route duration through a module-level setter.
  let nextDuration = 10
  FakeAudioContext.prototype.decodeAudioData = async function () {
    return fakeAudioBuffer(nextDuration)
  }
  globalThis.window = globalThis.window || {}
  globalThis.window.AudioContext = FakeAudioContext
  globalThis.AudioContext = FakeAudioContext
  return {
    setNextDuration: d => {
      nextDuration = d
    },
  }
}

// Build a fresh store with globals installed and Pinia active. Returns the store.
export async function makeStore() {
  installStoreGlobals()
  setActivePinia(createPinia())
  const { useZtudioStore } = await import('@/stores/ztudio')
  return useZtudioStore()
}
