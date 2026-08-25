import { createRuntimeState, createStorageState } from 'cross-window-state/renderer'

// Same factories, same signatures as the main process — this file runs
// unchanged in Electron windows and plain browser tabs.
const counter = createRuntimeState('counter', 0)
const settings = createStorageState('settings', { theme: 'light', notifications: true }, 1)

function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement
}

function render(): void {
  el('count').textContent = String(counter.state)
  ;(el('theme') as HTMLSelectElement).value = String(settings.state.theme)
  ;(el('notifications') as HTMLInputElement).checked = Boolean(settings.state.notifications)
  el('settings-view').textContent = JSON.stringify(settings.state)
}

el('inc').addEventListener('click', () => {
  counter.set((counter.state as number) + 1)
})
el('destroy').addEventListener('click', () => {
  counter.destroy()
})
el('theme').addEventListener('change', (e) => {
  settings.set('theme', (e.target as HTMLSelectElement).value)
})
el('notifications').addEventListener('change', (e) => {
  settings.set('notifications', (e.target as HTMLInputElement).checked)
})

const demo = (window as unknown as { __demo__?: { openWindow(): void } }).__demo__
if (demo) {
  const btn = el('open-window')
  btn.hidden = false
  btn.addEventListener('click', () => demo.openWindow())
}

counter.watch(render)
settings.watch('theme', render)
settings.watch('notifications', render)
render()
