import type { CrossWindowStateBridge } from './index'

declare global {
  interface Window {
    /** Injected by cross-window-state's preload script. */
    readonly __crossWindowState__: CrossWindowStateBridge
  }
}
