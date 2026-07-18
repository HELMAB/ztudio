# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ztudio (a.k.a. "greenroom") is a **fully client-side** Nuxt 4 SPA that turns audio + an optional still image + an optional `.srt` caption file into a captioned video, rendered and encoded entirely in the browser. There is no backend — all decoding, drawing, and encoding happens on the user's device. The default background is chroma-green (`#00B140`) for keying.

## Commands

Node version is pinned to 24 (`.nvmrc`).

```bash
npm run dev          # dev server at http://localhost:3000
npm run build        # production build
npm run generate     # static generation
npm run preview      # preview a production build
npm run lint         # eslint
npm run lint:fix     # eslint --fix
npm run format       # prettier --write .
npm run format:check # prettier --check .
npm test             # vitest run (unit tests)
npm run test:watch   # vitest in watch mode
npm run test:e2e     # playwright (E2E, auto-starts the dev server)
npm run test:e2e:ui  # playwright in UI mode
```

Tests live under `tests/`: unit tests in `tests/unit/`, E2E specs in `tests/e2e/`.

Unit tests use **Vitest** and live in `tests/unit/*.test.js` (run in the default Node
environment; the `@` alias resolves to `app/` — see `vitest.config.js`). Coverage:

- **`app/lib/ztudio/*`** pure logic — SRT parsing, segment building, keyframe
  interpolation, image/effect resolution, waveform peaks, caption geometry
  (`captionCenter`), ambiance overlays (`drawOverlay` against a mock 2D context),
  audio defaults, `sliceAudioBuffer`/`mrType`, the Khmer font registry, and
  config/overlay option consistency.
- **The Pinia store** (`tests/unit/store.test.js`) — instantiated with lightweight global
  stubs (`tests/unit/helpers/store.js` stubs `useNuxtApp`/`$i18n`, `createImageBitmap`, and
  `window.AudioContext`). Exercises the feature logic: trim clamping, caption CRUD
  (add/split/duplicate/remove/edit), titles, keyframes, image clips, presets ↔ custom,
  the normalized `style`, duration/dimension computeds, and selection-driven
  `inspectorTab`.

Notes for extending: the store calls its composables only inside the `defineStore`
setup, so stubbing globals before `useZtudioStore()` is enough — no DOM needed for the
logic paths. The encode/render/audio-mix paths (WebCodecs, canvas, OfflineAudioContext)
are integration-level and not unit-tested — they're exercised by E2E instead.

**E2E tests** use **Playwright** (Chromium) and live in `tests/e2e/*.spec.js`, one file
per feature area (boot/smoke, styling, animation, image+logo, titles, audio, media,
transport, timeline, preview, history, export). `playwright.config.js` auto-starts
`npm run dev` and uses a 1440×900 desktop viewport so `App.vue` renders
`DesktopWorkspace`. Each test runs in a fresh context (empty IndexedDB), so the bundled
demo media loads (incl. one seeded title) and the restore prompt never appears. The
`export.spec.js` test drives the real WebCodecs encode end-to-end (mediabunny loads from
a CDN at runtime, so that test needs network and gets a long timeout).

How the tests assert: a **dev-only** Nuxt plugin (`app/plugins/expose-store.client.js`,
guarded by `import.meta.dev`) puts the Pinia store on `window.__ztudio`, and
`tests/e2e/helpers.js` reads it via `state(page, 'controls.fontSizePct')` etc. — so a
slider/select/switch change is verified against real store state rather than the canvas.
Helpers: `boot`, `state`, `field` (a control by its Field label), `selectOption`,
`toggleSwitch`, `nudgeSlider` (keyboard), `inspectorTab`, and `DEMO` asset paths.

Selector conventions: prefer a `data-testid` over matching i18n text. Existing hooks:
`splash`, `inspector`, `export-button`, `preview-canvas`, `current-time`, `cue-list`,
`cue-text`, `caption-dialog-*`, `locale-toggle`, `title-controls`,
`timeline-add-caption`/`-title`/`-keyframe`, `result-overlay`/`-video`/`-download`,
`asset-list`/`asset-row`/`assets-import`.
Gotchas: the Media panel has its own icon-rail tabs — Assets (default)/Settings,
icon-only but still `role=tab` with those accessible names (scope inspector tab
queries to the `inspector` testid; uploads go through the Assets tab's mixed-type
import input `assets-import`; the resolution select lives under Settings); the audio
mix console — voice volume/fades plus the music-bed uploader and its controls — is the
inspector's Audio tab; the Style tab hosts BOTH caption and title controls
(scope title queries to `title-controls`); reka Switches sit inside their `<label>`, so
click the label hint text to toggle once; music-only controls (loop/ducking) render only
after a music bed is loaded.

Prettier: no semicolons, single quotes, width 100, trailing commas, no-parens arrow args. The codebase is **JavaScript, not TypeScript** (`components.json` has `typescript: false`); `tsconfig.json` only wires up Nuxt's generated configs.

## Architecture

Nuxt 4 layout: app code lives under `app/`. Components are auto-imported by directory-derived name — `app/components/ztudio/App.vue` is used as `<ZtudioApp>`, `MediaPanel.vue` as `<ZtudioMediaPanel>`, etc. shadcn-vue UI primitives in `app/components/ui/**` (built on Reka UI) are imported **without prefix** (`<Button>`, `<Tabs>`) and are git-tracked generated code that ESLint ignores — don't hand-edit them. Path alias `@/` → `app/`.

`app.vue` renders `<ZtudioApp>` inside `<ClientOnly>` because the whole tool depends on browser APIs (Canvas, WebCodecs, AudioContext, FontFace).

### State: one Pinia store drives everything

`app/stores/ztudio.js` (`useZtudioStore`) is the single source of truth — all media buffers, caption cues, style controls, playback, env detection, and the render lifecycle live here. Components are thin views over it. Key ideas:

- Media is held as decoded in-memory objects: `audioBuffer` (AudioBuffer), `imageBitmap` (ImageBitmap), `cues` (parsed array). Loaded via `loadAudio/loadImage/loadSrt/loadFont`.
- `controls` (reactive) holds caption styling. Presets in `config.js` populate it; editing any control flips `preset` to `'custom'` (guarded by an `applyingPreset` flag to avoid feedback loops).
- `redraw()` bumps `previewTick` — components watch this to repaint the canvas preview. Anything that changes the rendered output must call `redraw()`.
- `style` (computed) is the normalized style object passed to the renderer, merging `DEFAULT_STYLE` with `controls` and resolving the font stack.
- Playback (`play/pause/seek/togglePlay`) drives `scrub` (current time) via `requestAnimationFrame`, clocking off the AudioContext when audio is present.

### Rendering & encoding pipeline (`app/lib/ztudio/`)

This is the core complexity. `config.js` holds all constants/presets (`MAX_AUDIO_SEC = 300`, the green color, presets, dropdown option lists).

- **`renderer.js`** — `drawFrame(ctx, w, h, t, {...})` paints one frame to a 2D canvas: green fill → image (contain/cover) or placeholder → caption. `drawCaption` does manual multi-line layout with stroke/box, sized as percentages of height. This same function powers both the live preview and the encode, so preview and output stay identical.
- **`segments.js`** — `buildSegments(cues, total)` computes variable-length video frames: a frame boundary at every caption start/end plus a cap of `MAX_FRAME_DUR` (1s). This means a mostly-static video encodes as a handful of long frames instead of 30fps, which is the key performance trick.
- **`encoder.js`** — two pipelines, selected at runtime:
  - **Fast path** (`generateFast`): uses **mediabunny** (WebCodecs) loaded dynamically from a CDN (esm.sh, falling back to jsDelivr — see `loadMediabunny`). Encodes the variable-duration segments, prefers MP4 (h264+aac), falls back to WebM. `pickPipeline` probes codec support.
  - **Realtime fallback** (`generateRealtime`): when WebCodecs/mediabunny is unavailable, uses `MediaRecorder` capturing a `captureStream()` canvas in real time (so a 60s video takes 60s). Codec chosen from `MR_TYPES`.
  - `mrType()` reports MediaRecorder support; `runEnvCheck()` in the store classifies the environment (fast / realtime / none) into the `env` pill shown in the UI.
- **`srt.js`** — `parseSRT` (tolerant of `,`/`.` ms separators, BOM, CRLF) and `captionAt(t, cues)`.
- **`khmer-fonts.js`** — registry of bundled Khmer `.ttf` fonts in `public/fonts/khmer/`. Fonts are lazily loaded via the `FontFace` API on demand (`ensureBundledFont`); users can also upload custom fonts. Before encoding, `ensureRenderFont()` guarantees glyphs are loaded so frames don't render with fallback fonts.

### i18n

`@nuxtjs/i18n` with `en` and `km` (Khmer), `no_prefix` strategy, locale persisted in the `ztudio_locale` cookie. Locale files: `i18n/locales/{en,km}.json`. **All user-facing text is keyed** — UI components and the store use `t('...')`. The store stores status as `{ key, params }` (or `{ raw }` for already-translated dynamic messages) so status text re-translates on locale change. When adding UI text, add keys to both locale files. The app is built primarily for Khmer captioning (hence the bundled Khmer fonts and Khmer-first font defaults).

## Conventions

- Keep heavy logic in `app/lib/ztudio/*` as plain functions; keep the store as orchestration; keep components presentational.
- The activity log (`useActivityLog`) is the user-visible diagnostic channel — `log(...)` liberally through long operations; it's how users debug encode failures.
- Long operations check `isCancelled()` and yield to the event loop (`setTimeout(0)`) periodically so the UI stays responsive and Stop works.
