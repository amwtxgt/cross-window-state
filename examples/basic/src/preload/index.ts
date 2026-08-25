import { contextBridge, ipcRenderer } from 'electron'
import 'cross-window-state/preload'

// Demo-only surface: opening extra windows from the renderer.
contextBridge.exposeInMainWorld('__demo__', {
  openWindow: (): void => {
    ipcRenderer.invoke('demo:open-window')
  },
})
