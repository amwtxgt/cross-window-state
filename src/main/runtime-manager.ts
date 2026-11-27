/**
 * Main-process singleton that owns every runtime state, broadcasts updates
 * to subscribed renderers, and garbage-collects states once neither the main
 * process nor any renderer holds a reference.
 *
 * Reference counting rules:
 * - `acquire` (main process) bumps a per-name counter; `release` drops it.
 * - A renderer is auto-registered by its first `cws:runtime:get` and
 *   unregistered by `cws:runtime:clear` (sent on state destroy) or when its
 *   webContents dies.
 * - When both counts reach zero the state entry is deleted for real — no
 *   zombie entries for get-only keys that were never set.
 */
import { app, ipcMain, webContents } from "electron";
import type { WebContents } from "electron";
import { channel, runtimeUpdateChannel } from "../core/protocol";
import type { RuntimeUpdatePayload } from "../core/protocol";
import { createSignal } from "../core/signal";
import type { Signal } from "../core/signal";

export class RuntimeStateManager {
  private states = new Map<string, Signal<unknown>>();
  private rendererIds = new Map<string, Set<number>>();
  private senderKeys = new Map<number, Set<string>>();
  private watchedSenders = new Set<number>();
  private mainRefs = new Map<string, number>();

  constructor() {
    void app.whenReady().then(() => this.setupIpc());
  }

  private setupIpc(): void {
    ipcMain.on(channel.runtimeGet, (event, key: unknown) => {
      if (typeof key !== "string") {
        event.returnValue = undefined;
        return;
      }
      this.registerRenderer(key, event.sender);
      event.returnValue = this.states.get(key)?.value;
    });
    ipcMain.on(channel.runtimeSet, (event, key: unknown, value: unknown) => {
      if (typeof key !== "string" || key.length === 0) {
        // malformed keys could collide with channel naming (":") — reject
        console.error("[cws] runtime set rejected: key must be a non-empty string");
        return;
      }
      this.set(key, value, event.sender.id);
    });
    ipcMain.on(channel.runtimeClear, (event, key: unknown) => {
      if (typeof key !== "string") return;
      this.unregisterRenderer(key, event.sender.id);
    });
  }

  /**
   * Main-process acquire: bump the ref count. The first acquire creates the
   * signal with `defaultValue`; later acquires reuse the live value.
   */
  acquire<T>(name: string, defaultValue?: T): Signal<T> {
    let signal = this.states.get(name);
    if (!signal) {
      signal = createSignal<T>(defaultValue as T);
      this.states.set(name, signal);
    }
    this.mainRefs.set(name, (this.mainRefs.get(name) ?? 0) + 1);
    return signal as Signal<T>;
  }

  /** Main-process release. When the last ref drops, the state may be freed. */
  release(name: string): void {
    const refs = (this.mainRefs.get(name) ?? 0) - 1;
    if (refs > 0) {
      this.mainRefs.set(name, refs);
      return;
    }
    this.mainRefs.delete(name);
    this.maybeCleanup(name);
  }

  /** Current value for `name`, or undefined when absent/cleared. */
  get(name: string): unknown {
    return this.states.get(name)?.value;
  }

  /**
   * Set (or create) a state and broadcast to subscribed renderers.
   * `set(name, undefined)` clears the entry but still broadcasts
   * `{ newValue: undefined }` so renderers converge.
   *
   * `excludeSenderId` (the renderer that originated this set) is skipped by
   * the broadcast: that window's own `RuntimeState.set` already fired its
   * watchers optimistically, and the IPC round-trip would deserialize to a
   * fresh reference — the `Object.is` guard on the renderer side can't catch
   * it, so the sender's watchers would fire twice per set. Excluding the
   * sender matches web-mode semantics (BroadcastChannel never delivers a
   * message back to the posting context).
   */
  set(name: string, value: unknown, excludeSenderId?: number): void {
    let signal = this.states.get(name);
    if (!signal) {
      signal = createSignal(value);
      this.states.set(name, signal);
    }
    const oldValue = signal.value;
    signal.set(value);
    if (value === undefined) {
      // Clear for real: no zombie entries. Signal holders keep their last
      // value locally until they re-acquire.
      this.states.delete(name);
    }
    this.broadcast(name, { key: name, newValue: value, oldValue }, excludeSenderId);
  }

  private registerRenderer(key: string, sender: WebContents): void {
    if (sender.isDestroyed()) return;
    const senderId = sender.id;

    let ids = this.rendererIds.get(key);
    if (!ids) {
      ids = new Set();
      this.rendererIds.set(key, ids);
    }
    ids.add(senderId);

    let keys = this.senderKeys.get(senderId);
    if (!keys) {
      keys = new Set();
      this.senderKeys.set(senderId, keys);
    }
    keys.add(key);

    if (!this.watchedSenders.has(senderId)) {
      this.watchedSenders.add(senderId);
      sender.once("destroyed", () => {
        this.watchedSenders.delete(senderId);
        this.unregisterAllForSender(senderId);
      });
    }
  }

  private unregisterAllForSender(senderId: number): void {
    const keys = this.senderKeys.get(senderId);
    if (!keys) return;
    for (const key of [...keys]) {
      this.unregisterRenderer(key, senderId);
    }
  }

  private unregisterRenderer(key: string, senderId: number): void {
    const ids = this.rendererIds.get(key);
    if (ids) {
      ids.delete(senderId);
      if (ids.size === 0) {
        this.rendererIds.delete(key);
        this.maybeCleanup(key);
      }
    }
    const keys = this.senderKeys.get(senderId);
    if (keys) {
      keys.delete(key);
      if (keys.size === 0) {
        this.senderKeys.delete(senderId);
      }
    }
  }

  private maybeCleanup(key: string): void {
    const hasMainRef = this.mainRefs.has(key);
    const renderers = this.rendererIds.get(key);
    if (!hasMainRef && (!renderers || renderers.size === 0)) {
      this.states.delete(key);
      this.rendererIds.delete(key);
    }
  }

  private broadcast(key: string, payload: RuntimeUpdatePayload, excludeSenderId?: number): void {
    const ids = this.rendererIds.get(key);
    if (!ids || ids.size === 0) return;
    const invalid: number[] = [];
    for (const id of ids) {
      // The originating renderer already applied the change locally (its
      // RuntimeState.set fires watchers optimistically); echoing back would
      // double-fire them. Main-process sets carry no sender and reach everyone.
      if (id === excludeSenderId) continue;
      // webContents may be gone or mid-destruction; treat all failures as
      // "drop the subscriber" instead of letting one dead window break the
      // broadcast loop.
      try {
        const wc = webContents.fromId(id);
        if (!wc || wc.isDestroyed()) {
          invalid.push(id);
          continue;
        }
        wc.send(runtimeUpdateChannel(key), payload);
      } catch {
        invalid.push(id);
      }
    }
    for (const id of invalid) {
      this.unregisterRenderer(key, id);
    }
  }
}

/** Process-wide singleton used by `createRuntimeState` (main). */
export const runtimeStateManager = new RuntimeStateManager();
