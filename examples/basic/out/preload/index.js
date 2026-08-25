//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
//#endregion
let electron = require("electron");
(/* @__PURE__ */ __commonJSMin((() => {
	var electron$1 = require("electron");
	/**
	* IPC wire protocol shared by main, preload and renderer.
	*
	* Every channel is prefixed with `cws:` (cross-window-state) so the library
	* can never collide with host-app channels. Update channels embed the state
	* name (and optionally the key) so subscriptions are narrowly scoped.
	*/
	/** Base channel names. Update events append `:{key}` / `:{name}[:{key}]`. */
	var channel = {
		/** renderer → main, `send`, payload `{ key, value }`. */
		runtimeSet: "cws:runtime:set",
		/** renderer → main, `sendSync`, returns current value; registers sender for broadcasts. */
		runtimeGet: "cws:runtime:get",
		/** renderer → main, `send`, unregisters sender; may release the state. */
		runtimeClear: "cws:runtime:clear",
		/** Base for main → renderer broadcast channels: `cws:runtime:update:{key}`. */
		runtimeUpdate: "cws:runtime:update",
		/** renderer → main, `sendSync`, returns merged state; creates the store on first call. */
		storageGet: "cws:storage:get",
		/** renderer → main, `send`, payload `{ name, patch }`. */
		storageSet: "cws:storage:set",
		/** Base for main → renderer broadcast channels: `cws:storage:update:{name}[:{key}]`. */
		storageUpdate: "cws:storage:update"
	};
	/** Per-key runtime broadcast channel, e.g. `cws:runtime:update:theme`. */
	function runtimeUpdateChannel(key) {
		return `${channel.runtimeUpdate}:${key}`;
	}
	/**
	* Storage broadcast channel. With a key: `cws:storage:update:{name}:{key}`
	* (what preload/renderer consume). Without: whole-state form reserved for
	* future use.
	*/
	function storageUpdateChannel(name, key) {
		return key === void 0 ? `${channel.storageUpdate}:${name}` : `${channel.storageUpdate}:${name}:${key}`;
	}
	/**
	* Preload bridge — load with `require('cross-window-state/preload')` (a
	* single .cjs file, since sandboxed preloads do not support ESM).
	*
	* Exposes `window.__crossWindowState__` with `runtime` and `storage` faces.
	*
	* Unsubscribe discipline: every on* wrapper is kept in a local variable and
	* the SAME reference is passed to `ipcRenderer.off`. The predecessor library
	* passed the raw user callback to off(), which matched nothing — listeners
	* leaked forever. Covered by regression tests.
	*/
	electron$1.contextBridge.exposeInMainWorld("__crossWindowState__", {
		runtime: {
			get(key) {
				return electron$1.ipcRenderer.sendSync(channel.runtimeGet, key);
			},
			set(key, value) {
				electron$1.ipcRenderer.send(channel.runtimeSet, key, value);
			},
			clear(key) {
				electron$1.ipcRenderer.send(channel.runtimeClear, key);
			},
			onStateUpdated(key, cb) {
				const ch = runtimeUpdateChannel(key);
				const wrapped = (_event, payload) => cb(payload);
				electron$1.ipcRenderer.on(ch, wrapped);
				return () => {
					electron$1.ipcRenderer.off(ch, wrapped);
				};
			}
		},
		storage: {
			get(name, payload) {
				return electron$1.ipcRenderer.sendSync(channel.storageGet, name, payload);
			},
			set(name, patch, key) {
				electron$1.ipcRenderer.send(channel.storageSet, name, patch, key);
			},
			onStateUpdated(name, key, cb) {
				const ch = storageUpdateChannel(name, key);
				const wrapped = (_event, value) => cb(value);
				electron$1.ipcRenderer.on(ch, wrapped);
				return () => {
					electron$1.ipcRenderer.off(ch, wrapped);
				};
			}
		}
	});
})))();
electron.contextBridge.exposeInMainWorld("__demo__", { openWindow: () => {
	electron.ipcRenderer.invoke("demo:open-window");
} });
//#endregion
