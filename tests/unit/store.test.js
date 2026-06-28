import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { makeStore, audioFile, imageFile, stubAudioContext } from './helpers/store'

const srt = (...blocks) => ({ text: async () => blocks.join('\n\n') })
const CUE = (n, a, b) => `${n}\n00:00:0${a},000 --> 00:00:0${b},000\nline ${n}`

let audioCtl
beforeEach(() => {
  audioCtl = stubAudioContext()
})

// Load audio of a given duration into the store (drives previewDuration/trim).
async function withAudio(store, duration = 10) {
  audioCtl.setNextDuration(duration)
  await store.loadAudio(audioFile(duration))
}

describe('store: dimensions & duration', () => {
  it('parses the resolution into width/height', async () => {
    const store = await makeStore()
    expect(store.dimensions).toEqual({ w: 1080, h: 1920 })
    store.resolution = '1920x1080'
    expect(store.dimensions).toEqual({ w: 1920, h: 1080 })
  })

  it('falls back to a min 10s preview duration with no audio', async () => {
    const store = await makeStore()
    expect(store.previewDuration).toBe(10)
  })

  it('uses the caption span when longer than the floor and no audio', async () => {
    const store = await makeStore()
    await store.loadSrt(srt(CUE(1, 1, 2), `2\n00:00:11,000 --> 00:00:14,000\nlong`))
    expect(store.previewDuration).toBe(14)
  })

  it('uses the audio duration once audio is loaded', async () => {
    const store = await makeStore()
    await withAudio(store, 42)
    expect(store.previewDuration).toBe(42)
  })
})

describe('store: trim', () => {
  it('is a no-op without audio', async () => {
    const store = await makeStore()
    store.setTrim(1, 5)
    expect(store.hasTrim).toBe(false)
  })

  it('sets and clamps a trim window inside the clip', async () => {
    const store = await makeStore()
    await withAudio(store, 20)
    store.setTrim(5, 15)
    expect(store.trimWindow).toEqual({ from: 5, to: 15 })
    expect(store.outputDuration).toBe(10)
    expect(store.hasTrim).toBe(true)
  })

  it('enforces a minimum gap between start and end', async () => {
    const store = await makeStore()
    await withAudio(store, 20)
    store.setTrim(10, 10) // zero-length request
    // MIN_GAP is 0.1; 3-decimal rounding can shave a hair, so allow tolerance.
    expect(store.trimWindow.to - store.trimWindow.from).toBeCloseTo(0.1, 3)
  })

  it('clamps a trim beyond the clip bounds', async () => {
    const store = await makeStore()
    await withAudio(store, 8)
    store.setTrim(-5, 999)
    expect(store.trimWindow.from).toBe(0)
    expect(store.trimWindow.to).toBe(8)
  })

  it('resets the trim back to the full clip', async () => {
    const store = await makeStore()
    await withAudio(store, 12)
    store.setTrim(2, 9)
    store.resetTrim()
    expect(store.hasTrim).toBe(false)
  })
})

describe('store: captions', () => {
  it('parses an SRT file into cues', async () => {
    const store = await makeStore()
    await store.loadSrt(srt(CUE(1, 1, 2), CUE(2, 3, 4)))
    expect(store.cues).toHaveLength(2)
    expect(store.currentCaption).toBe('')
  })

  it('adds a caption from explicit values', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.addCaption('hello', 1, 3)
    expect(store.cues).toHaveLength(1)
    expect(store.cues[0]).toMatchObject({ text: 'hello', start: 1, end: 3 })
  })

  it('edits caption text', async () => {
    const store = await makeStore()
    store.addCaption('a', 0, 1)
    store.setCueText(0, 'changed')
    expect(store.cues[0].text).toBe('changed')
  })

  it('removes a caption', async () => {
    const store = await makeStore()
    store.addCaption('a', 0, 1)
    store.removeCue(0)
    expect(store.cues).toHaveLength(0)
    expect(store.selectedCueIndex).toBeNull()
  })

  it('splits a caption at the playhead', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.addCaption('split me', 0, 4)
    store.seek(2)
    store.splitCueAt(0)
    expect(store.cues).toHaveLength(2)
    expect(store.cues[0].end).toBe(2)
    expect(store.cues[1].start).toBe(2)
  })

  it('does not split when the playhead is at the very edge', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.addCaption('x', 0, 4)
    store.seek(0.01)
    store.splitCueAt(0)
    expect(store.cues).toHaveLength(1)
  })

  it('duplicates a caption right after the original', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.addCaption('dup', 1, 3)
    store.duplicateCue(0)
    expect(store.cues).toHaveLength(2)
    expect(store.cues[1].start).toBe(3) // placed after the original
  })

  it('selecting a cue opens the Style inspector tab', async () => {
    const store = await makeStore()
    store.addCaption('a', 0, 1)
    store.inspectorTab = 'image'
    store.selectCue(0)
    expect(store.inspectorTab).toBe('style')
  })

  it('goToCue seeks to the cue start without changing the tab', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.addCaption('a', 5, 8)
    store.inspectorTab = 'cues'
    store.goToCue(0)
    expect(store.scrub).toBe(5)
    expect(store.inspectorTab).toBe('cues')
  })
})

describe('store: layer focus drives the drag target', () => {
  it('defaults the drag target to the caption layer', async () => {
    const store = await makeStore()
    expect(store.dragTarget).toBe('caption')
  })

  it('selecting an image focuses the image layer', async () => {
    const store = await makeStore()
    await withAudio(store, 20)
    await store.addImages([imageFile()])
    store.selectImage(store.images[0].id)
    expect(store.dragTarget).toBe('image')
  })

  it('selecting a title focuses the title layer', async () => {
    const store = await makeStore()
    const tx = store.addText()
    store.selectText(tx.id)
    expect(store.dragTarget).toBe('title')
  })

  it('selecting a cue focuses the caption layer again', async () => {
    const store = await makeStore()
    const tx = store.addText()
    store.selectText(tx.id)
    expect(store.dragTarget).toBe('title')
    store.addCaption('a', 0, 1)
    store.selectCue(0)
    expect(store.dragTarget).toBe('caption')
  })

  it('goToCue also focuses the caption layer', async () => {
    const store = await makeStore()
    await withAudio(store, 20)
    await store.addImages([imageFile()])
    store.selectImage(store.images[0].id)
    expect(store.dragTarget).toBe('image')
    store.addCaption('a', 2, 4)
    store.goToCue(0)
    expect(store.dragTarget).toBe('caption')
  })
})

describe('store: titles', () => {
  it('adds a title using the default-text i18n key', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    const item = store.addText()
    expect(store.texts).toHaveLength(1)
    expect(item.text).toBe('textOverlay.defaultText')
  })

  it('selecting a title opens the Style tab and clears cue selection', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.addCaption('a', 0, 1)
    store.selectCue(0)
    const item = store.addText()
    store.selectText(item.id)
    expect(store.inspectorTab).toBe('style')
    expect(store.selectedCueIndex).toBeNull()
  })

  it('updates a title field', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    const item = store.addText()
    store.updateText(item.id, { text: 'My title' })
    expect(store.texts[0].text).toBe('My title')
  })

  it('clamps a title position to [0,1]', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    const item = store.addText()
    store.setTextPos(item.id, -1, 5)
    expect(store.texts[0].x).toBe(0)
    expect(store.texts[0].y).toBe(1)
  })

  it('clamps title timing to the clip and a min duration', async () => {
    const store = await makeStore()
    await withAudio(store, 10)
    const item = store.addText()
    store.updateTextTime(item.id, -5, 999)
    expect(store.texts[0].start).toBe(0)
    expect(store.texts[0].end).toBe(10)
  })

  it('removes a title', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    const item = store.addText()
    store.removeText(item.id)
    expect(store.texts).toHaveLength(0)
  })
})

describe('store: keyframes', () => {
  it('adds a keyframe at the playhead', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.seek(3)
    store.addKeyframe()
    expect(store.keyframes).toHaveLength(1)
    expect(store.keyframes[0].t).toBe(3)
    expect(store.hasKeyframes).toBe(true)
  })

  it('does not duplicate a keyframe at (nearly) the same time', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.seek(3)
    store.addKeyframe()
    store.addKeyframe()
    expect(store.keyframes).toHaveLength(1)
  })

  it('moves and re-sorts keyframes, clamping to the duration', async () => {
    const store = await makeStore()
    await withAudio(store, 10)
    store.seek(2)
    store.addKeyframe()
    store.seek(6)
    store.addKeyframe()
    const first = store.keyframes[0]
    store.moveKeyframe(first.id, 999)
    expect(store.keyframes.map(k => k.t)).toEqual([6, 10]) // clamped + sorted
  })

  it('selecting a keyframe opens the Animation tab', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.seek(3)
    store.addKeyframe()
    store.inspectorTab = 'style'
    store.selectKeyframe(store.keyframes[0].id)
    expect(store.inspectorTab).toBe('animation')
  })

  it('removes a keyframe', async () => {
    const store = await makeStore()
    await withAudio(store, 30)
    store.seek(3)
    store.addKeyframe()
    store.removeKeyframe(store.keyframes[0].id)
    expect(store.keyframes).toHaveLength(0)
  })
})

describe('store: images', () => {
  it('adds a first image spanning the whole duration', async () => {
    const store = await makeStore()
    await withAudio(store, 20)
    await store.addImages([imageFile('a.png', 800, 600)])
    expect(store.images).toHaveLength(1)
    expect(store.images[0]).toMatchObject({ start: 0, end: 20, width: 800, height: 600 })
    expect(store.hasImages).toBe(true)
  })

  it('selecting an image opens the Image tab', async () => {
    const store = await makeStore()
    await withAudio(store, 20)
    await store.addImages([imageFile()])
    store.inspectorTab = 'style'
    store.selectImage(store.images[0].id)
    expect(store.inspectorTab).toBe('image')
  })

  it('changes the image effect on the selected clip', async () => {
    const store = await makeStore()
    await withAudio(store, 20)
    await store.addImages([imageFile()])
    store.selectImage(store.images[0].id)
    store.setImageEffect('noir')
    expect(store.selectedImage.effect).toBe('noir')
  })

  it('clamps an image clip time to the window', async () => {
    const store = await makeStore()
    await withAudio(store, 10)
    await store.addImages([imageFile()])
    const id = store.images[0].id
    store.updateImageTime(id, -3, 999)
    expect(store.images[0].start).toBe(0)
    expect(store.images[0].end).toBe(10)
  })

  it('removes an image', async () => {
    const store = await makeStore()
    await withAudio(store, 20)
    await store.addImages([imageFile()])
    store.removeImage(store.images[0].id)
    expect(store.images).toHaveLength(0)
  })
})

describe('store: presets & style', () => {
  it('applyPreset writes the preset values into controls', async () => {
    const store = await makeStore()
    store.applyPreset('yellow')
    await nextTick()
    expect(store.controls.fill).toBe('#ffe14d')
    expect(store.controls.fontWeight).toBe('700')
    expect(store.controls.box).toBe(false)
  })

  it('editing a styled control flips the preset to custom', async () => {
    const store = await makeStore()
    store.applyPreset('clean')
    await nextTick() // let applyingPreset settle
    store.controls.fontSizePct = 0.077
    await nextTick() // let the controls watcher run
    expect(store.preset).toBe('custom')
  })

  it('the normalized style reflects the current controls', async () => {
    const store = await makeStore()
    store.controls.fill = '#123456'
    store.controls.position = 'top'
    expect(store.style.fill).toBe('#123456')
    expect(store.style.position).toBe('top')
    expect(store.style.fontFamily).toContain('Noto Sans Khmer')
  })

  it('the default ambiance overlay is falling leaves', async () => {
    const store = await makeStore()
    expect(store.controls.overlay).toBe('leaves')
    expect(store.style.overlay).toBe('leaves')
  })
})

describe('store: preview monitor & loop', () => {
  it('defaults: not looping, full volume, not muted', async () => {
    const store = await makeStore()
    expect(store.loopPlayback).toBe(false)
    expect(store.previewVolume).toBe(1)
    expect(store.muted).toBe(false)
  })

  it('toggles loop playback', async () => {
    const store = await makeStore()
    store.loopPlayback = true
    expect(store.loopPlayback).toBe(true)
    store.loopPlayback = false
    expect(store.loopPlayback).toBe(false)
  })

  it('toggleMute flips the muted state', async () => {
    const store = await makeStore()
    store.toggleMute()
    expect(store.muted).toBe(true)
    store.toggleMute()
    expect(store.muted).toBe(false)
  })

  it('accepts a monitor volume level', async () => {
    const store = await makeStore()
    store.previewVolume = 0.5
    expect(store.previewVolume).toBe(0.5)
  })
})

describe('store: workspace layout', () => {
  it('defaults to both side panels open at their base sizes', async () => {
    const store = await makeStore()
    expect(store.layout.mediaOpen).toBe(true)
    expect(store.layout.inspectorOpen).toBe(true)
    expect(store.layout.mediaWidth).toBe(288)
    expect(store.layout.inspectorWidth).toBe(320)
    expect(store.layout.timelineHeight).toBe(192)
  })

  it('sets a panel size and clamps it to the allowed range', async () => {
    const store = await makeStore()
    store.setPanelSize('mediaWidth', 360)
    expect(store.layout.mediaWidth).toBe(360)
    // Below the minimum clamps to the floor, above the max to the ceiling.
    store.setPanelSize('mediaWidth', 50)
    expect(store.layout.mediaWidth).toBe(220)
    store.setPanelSize('mediaWidth', 9999)
    expect(store.layout.mediaWidth).toBe(480)
  })

  it('ignores an unknown layout dimension', async () => {
    const store = await makeStore()
    expect(() => store.setPanelSize('bogus', 100)).not.toThrow()
    expect(store.layout.bogus).toBeUndefined()
  })

  it('toggles the media and inspector panels', async () => {
    const store = await makeStore()
    store.toggleMediaPanel()
    expect(store.layout.mediaOpen).toBe(false)
    store.toggleMediaPanel()
    expect(store.layout.mediaOpen).toBe(true)
    store.toggleInspectorPanel()
    expect(store.layout.inspectorOpen).toBe(false)
  })
})

describe('store: undo/redo public surface', () => {
  it('starts with nothing to undo or redo, and undo/redo are safe no-ops', async () => {
    const store = await makeStore()
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
    expect(() => {
      store.undo()
      store.redo()
    }).not.toThrow()
  })
})
