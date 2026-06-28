import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'

// Bundled demo assets (also used to drive upload tests).
const root = fileURLToPath(new URL('../..', import.meta.url))
export const DEMO = {
  audio: `${root}/public/demo/sound.mp3`,
  image: `${root}/public/demo/image.png`,
  srt: `${root}/public/demo/caption.srt`,
  logo: `${root}/public/logo.svg`,
  font: `${root}/public/fonts/khmer/dangrek.ttf`,
}

// Boot: wait for the splash to clear and the demo media to finish loading
// (Export becomes enabled). Each Playwright context is isolated (empty
// IndexedDB), so the demo loads and the restore prompt never appears.
export async function boot(page) {
  await page.goto('/')
  await expect(page.getByTestId('splash')).toBeHidden({ timeout: 30_000 })
  await expect(page.getByTestId('export-button')).toBeEnabled()
}

// Read a value out of the live Pinia store (exposed on window in dev). `path` is
// a dotted accessor, e.g. 'controls.fontSizePct' or 'selectedImage.effect'.
export function state(page, path) {
  return page.evaluate(p => {
    let v = window.__ztudio
    for (const k of p.split('.')) {
      v = v?.[k]
      // Unwrap Vue refs if a raw ref leaks through.
      if (v && typeof v === 'object' && 'value' in v && Object.keys(v).length === 1) {
        v = v.value
      }
    }
    return v
  }, path)
}

// The Field wrapper (label + control) whose label contains `labelText`, scoped to
// a container locator (e.g. the inspector).
export function field(container, labelText) {
  return container.locator(`div:has(> label:has-text("${labelText}"))`).first()
}

// Open a reka Select (by its Field label) and choose the option by visible text.
export async function selectOption(page, container, labelText, optionText) {
  await field(container, labelText).getByRole('combobox').click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

// Toggle a Switch found under a Field label. Returns the switch locator.
export async function toggleSwitch(container, labelText) {
  const sw = field(container, labelText).getByRole('switch')
  await sw.click()
  return sw
}

// Nudge a slider (under a Field label) with the keyboard. Focus the thumb and
// press an arrow key `times` times. Direction: 'right' (increase) or 'left'.
export async function nudgeSlider(page, container, labelText, direction = 'right', times = 3) {
  const slider = field(container, labelText).getByRole('slider').first()
  await slider.focus()
  const key = direction === 'right' ? 'ArrowRight' : 'ArrowLeft'
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key)
  }
}

// Switch the inspector to a given tab (scoped so the Media panel's tabs don't clash).
export async function inspectorTab(page, name) {
  await page.getByTestId('inspector').getByRole('tab', { name, exact: true }).click()
}
