let electron = require("electron");
let node_path = require("node:path");
let node_fs = require("node:fs");
let node_fs_promises = require("node:fs/promises");
//#region ../../dist/protocol-DTI34xOD.mjs
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
//#endregion
//#region ../../dist/utils-DhHC_Pkl.mjs
/** Trailing-edge debounce. Leading calls are intentionally not supported. */
function debounce(fn, wait) {
	let timer;
	let lastArgs;
	const wrapped = ((...args) => {
		lastArgs = args;
		if (timer !== void 0) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = void 0;
			const pending = lastArgs;
			lastArgs = void 0;
			if (pending) fn(...pending);
		}, wait);
	});
	wrapped.cancel = () => {
		if (timer !== void 0) {
			clearTimeout(timer);
			timer = void 0;
		}
		lastArgs = void 0;
	};
	wrapped.flush = () => {
		if (timer !== void 0) {
			clearTimeout(timer);
			timer = void 0;
		}
		const pending = lastArgs;
		lastArgs = void 0;
		if (pending) fn(...pending);
	};
	return wrapped;
}
function isPlainObject(value) {
	if (typeof value !== "object" || value === null) return false;
	if (Array.isArray(value)) return false;
	return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}
/**
* Structural equality for JSON-shaped data (what storage state holds).
* Key order is ignored; arrays are order-sensitive; `undefined` values are
* distinct from missing keys. Circular structures return false instead of
* looping forever — good enough for the defaults-validation use case.
*/
function deepEqual(a, b) {
	return deepEqualWithCycleCheck(a, b, /* @__PURE__ */ new WeakSet());
}
function deepEqualWithCycleCheck(a, b, path) {
	if (Object.is(a, b)) return true;
	if (typeof a !== "object" || a === null) return false;
	if (typeof b !== "object" || b === null) return false;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (path.has(a)) return false;
		path.add(a);
		const ok = a.length === b.length && a.every((item, i) => deepEqualWithCycleCheck(item, b[i], path));
		path.delete(a);
		return ok;
	}
	if (!isPlainObject(a) || !isPlainObject(b)) return false;
	if (path.has(a)) return false;
	path.add(a);
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	const ok = keysA.length === keysB.length && keysA.every((key) => key in b && deepEqualWithCycleCheck(a[key], b[key], path));
	path.delete(a);
	return ok;
}
/**
* Wrap `data` in a Proxy that routes writes through callbacks while reads,
* iteration and spread behave like the plain object. This is the machinery
* behind the writable `.state` on both main and renderer storage states —
* `state.key = value` transparently goes through the sync pipeline.
*
* Write semantics: `data` is updated first, then the callback fires; a
* throwing callback propagates to the assignment expression while the data
* change itself is kept (no rollback) — the caller decides how to react.
*
* `delete proxy.key` calls `onDelete(key)` when provided, otherwise
* `onSet(key, undefined)` so deletes keep flowing through the same pipeline.
*/
function createProxyState(data, onSet, onDelete) {
	return new Proxy(data, {
		get(target, prop, receiver) {
			return Reflect.get(target, prop, receiver);
		},
		set(target, prop, value) {
			const ok = Reflect.set(target, prop, value);
			if (ok && typeof prop === "string") onSet(prop, value);
			return ok;
		},
		deleteProperty(target, prop) {
			const ok = Reflect.deleteProperty(target, prop);
			if (ok && typeof prop === "string") {
				if (onDelete) onDelete(prop);
				else onSet(prop, void 0);
			}
			return ok;
		},
		has(target, prop) {
			return Reflect.has(target, prop);
		},
		ownKeys(target) {
			return Reflect.ownKeys(target);
		},
		getOwnPropertyDescriptor(target, prop) {
			return Reflect.getOwnPropertyDescriptor(target, prop);
		}
	});
}
//#endregion
//#region ../../dist/main/index.mjs
function createSignal(initial, options) {
	const equality = options?.equality ?? "identity";
	let value = initial;
	const listeners = /* @__PURE__ */ new Set();
	let notifying = false;
	let pending;
	let hasPending = false;
	function notify(next, old) {
		notifying = true;
		try {
			for (const cb of [...listeners]) try {
				cb(next, old);
			} catch (err) {
				console.error("[cws:signal] listener error:", err);
			}
		} finally {
			notifying = false;
			if (hasPending) {
				hasPending = false;
				doSet(pending);
			}
		}
	}
	function doSet(next) {
		const old = value;
		if (equality === "identity" && Object.is(old, next)) return;
		value = next;
		notify(next, old);
	}
	return {
		get value() {
			return value;
		},
		set(next) {
			if (notifying) {
				pending = next;
				hasPending = true;
				if (equality === "identity" && Object.is(value, next)) hasPending = false;
				return;
			}
			doSet(next);
		},
		subscribe(cb) {
			listeners.add(cb);
			return () => {
				listeners.delete(cb);
			};
		}
	};
}
/**
* Main-process persistent store: JSON file + versioned migration + debounced
* atomic writes, shared with renderer windows over IPC.
*
* Design notes (pitfalls hit by the predecessor implementation, fixed here):
* - Writes are atomic (tmp file + rename) with a direct-write fallback, so a
*   crash mid-write cannot corrupt the previous state.
* - Debounced saves run through a drain loop that always serializes the
*   LATEST data, so a queued save can never overwrite newer state with an
*   older snapshot.
* - First creation, migrations and repairs write synchronously — renderers
*   fetch state via sendSync, so the file must exist before construction
*   returns. `destroy()` also flushes synchronously (app-quit safe).
* - A corrupted file falls back to defaults AND is repaired on disk right
*   away, so the corruption does not linger.
* - Option defaults use `??` so explicit 0 values are respected.
*/
var SAVE_DEBOUNCE_MS = 300;
var NAME_RE = /^[a-zA-Z0-9_-]+$/;
var StorageStore = class StorageStore {
	/** All live stores by name — same name+version reuses one instance. */
	static instances = /* @__PURE__ */ new Map();
	name;
	version;
	isNew;
	defaults;
	data;
	filePath;
	maxRetries;
	retryDelay;
	keySignals = /* @__PURE__ */ new Map();
	rootSignal;
	proxyState;
	debouncedSave;
	rendererIds = /* @__PURE__ */ new Set();
	dirty = false;
	writeInFlight = false;
	destroyed = false;
	constructor(name, defaults, version, options) {
		if (!NAME_RE.test(name)) throw new Error(`[cws] StorageStore: invalid name "${name}" (must match ${NAME_RE.source})`);
		this.name = name;
		this.defaults = { ...defaults };
		this.version = version;
		this.maxRetries = options?.maxRetries ?? 3;
		this.retryDelay = options?.retryDelay ?? 1e3;
		const existing = StorageStore.instances.get(name);
		if (existing) {
			if (existing.version === version) {
				if (options?.skipDefaultsCheck || deepEqual(existing.defaults, this.defaults)) return existing;
				throw new Error(`[cws] StorageStore("${name}") already exists with different defaults; pass skipDefaultsCheck to reuse anyway.`);
			}
			existing.destroy();
		}
		const dir = (0, node_path.join)(electron.app.getPath("userData"), options?.dir ?? "cross-window-state");
		this.filePath = (0, node_path.join)(dir, `${name}.json`);
		const loaded = this.load();
		this.data = loaded.data;
		this.isNew = loaded.isNew;
		this.rootSignal = createSignal({ ...this.data }, { equality: "always" });
		this.proxyState = createProxyState(this.data, (key) => this.onDataChanged(key), (key) => this.onDataChanged(key));
		this.debouncedSave = debounce(() => this.startSaveLoop(), SAVE_DEBOUNCE_MS);
		StorageStore.instances.set(name, this);
		if (loaded.isNew || loaded.migrated || loaded.repaired) {
			this.dirty = false;
			this.writeSyncNow();
		}
	}
	load() {
		let stored = null;
		let repaired = false;
		try {
			const raw = readFileSyncSafe(this.filePath);
			if (raw !== null) {
				const parsed = JSON.parse(raw);
				if (isStoredShape(parsed)) stored = parsed;
				else repaired = true;
			}
		} catch {
			repaired = true;
		}
		if (!stored) {
			(0, node_fs.mkdirSync)((0, node_path.dirname)(this.filePath), { recursive: true });
			return {
				data: { ...this.defaults },
				isNew: true,
				migrated: false,
				repaired
			};
		}
		if (stored.version === this.version) return {
			data: {
				...this.defaults,
				...stored.data
			},
			isNew: false,
			migrated: false,
			repaired
		};
		const next = { ...stored.data };
		for (const key of Object.keys(this.defaults)) {
			const defaultValue = this.defaults[key];
			if (!(key in next) || typeof next[key] !== typeof defaultValue) next[key] = defaultValue;
		}
		for (const key of Object.keys(next)) if (!(key in this.defaults)) delete next[key];
		return {
			data: next,
			isNew: false,
			migrated: true,
			repaired
		};
	}
	/** Merged current state. Direct writes (`s.state.k = v`) sync + persist. */
	get state() {
		return this.proxyState;
	}
	set(keyOrPatch, value) {
		if (typeof keyOrPatch === "string") this.applyChange(keyOrPatch, value);
		else for (const [key, val] of Object.entries(keyOrPatch)) this.applyChange(key, val);
	}
	applyChange(key, value) {
		if (this.destroyed) {
			console.error(`[cws] StorageStore("${this.name}") was destroyed; set() is ignored.`);
			return;
		}
		this.data[key] = value;
		this.onDataChanged(key);
	}
	onDataChanged(key) {
		this.keySignals.get(key)?.set(this.data[key]);
		this.rootSignal.set({ ...this.data });
		this.notifyRenderers(key);
		this.dirty = true;
		this.debouncedSave();
	}
	/** Subscribe to one key's changes. Returns an unsubscribe function. */
	watch(key, cb) {
		if (this.destroyed) {
			console.error(`[cws] StorageStore("${this.name}") was destroyed; watch() is ignored.`);
			return () => {};
		}
		let signal = this.keySignals.get(key);
		if (!signal) {
			signal = createSignal(this.data[key], { equality: "always" });
			this.keySignals.set(key, signal);
		}
		return signal.subscribe(cb);
	}
	/** Subscribe to every change with a full-state snapshot. */
	subscribe(cb) {
		return this.rootSignal.subscribe((next) => cb(next));
	}
	serialize() {
		return JSON.stringify({
			version: this.version,
			data: { ...this.data },
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}, null, 2);
	}
	/**
	* Drain loop: while writes are in flight, later saves just mark dirty;
	* each iteration serializes the latest data, so a queued write can never
	* clobber newer state with an older snapshot.
	*/
	startSaveLoop() {
		if (this.writeInFlight) return;
		this.writeInFlight = true;
		(async () => {
			try {
				while (this.dirty) {
					this.dirty = false;
					await this.writeWithRetry(this.serialize());
				}
			} catch (err) {
				console.error(`[cws] StorageStore("${this.name}") persist failed:`, err);
				this.dirty = false;
			} finally {
				this.writeInFlight = false;
			}
		})();
	}
	async writeWithRetry(payload) {
		let attempt = 0;
		for (;;) try {
			await this.writeOnce(payload);
			return;
		} catch (err) {
			if (attempt + 1 >= this.maxRetries) throw err;
			attempt++;
			await delay(this.retryDelay);
		}
	}
	async writeOnce(payload) {
		const tmp = `${this.filePath}.tmp`;
		try {
			await (0, node_fs_promises.writeFile)(tmp, payload, "utf-8");
			await (0, node_fs_promises.rename)(tmp, this.filePath);
		} catch {
			await (0, node_fs_promises.writeFile)(this.filePath, payload, "utf-8");
		}
	}
	/** Synchronous atomic write for construction and destroy paths. */
	writeSyncNow() {
		const payload = this.serialize();
		const tmp = `${this.filePath}.tmp`;
		try {
			(0, node_fs.writeFileSync)(tmp, payload, "utf-8");
			(0, node_fs.renameSync)(tmp, this.filePath);
		} catch {
			try {
				(0, node_fs.writeFileSync)(this.filePath, payload, "utf-8");
			} catch (err) {
				console.error(`[cws] StorageStore("${this.name}") initial persist failed:`, err);
				this.dirty = true;
			}
		}
	}
	/** Flush pending debounced writes synchronously (app-quit safe). */
	flushSync() {
		this.debouncedSave.cancel();
		if (this.dirty) {
			this.dirty = false;
			this.writeSyncNow();
		}
	}
	/** Flush pending writes synchronously and drop the instance. */
	destroy() {
		if (this.destroyed) {
			console.error(`[cws] StorageStore("${this.name}") is already destroyed.`);
			return;
		}
		this.destroyed = true;
		this.flushSync();
		StorageStore.instances.delete(this.name);
		this.rendererIds.clear();
	}
	/** State snapshot for a renderer; registers it for future broadcasts. */
	getByRenderer(senderId) {
		this.rendererIds.add(senderId);
		return { ...this.data };
	}
	/** Apply a patch coming from a renderer (same semantics as local set). */
	setByRenderer(patch, key) {
		if (key !== void 0) this.applyChange(key, patch[key]);
		else for (const [k, v] of Object.entries(patch)) this.applyChange(k, v);
	}
	/** Broadcast a changed key to registered renderers, pruning dead ones. */
	notifyRenderers(key) {
		if (this.rendererIds.size === 0) return;
		const invalid = [];
		for (const id of this.rendererIds) try {
			const wc = electron.webContents.fromId(id);
			if (!wc || wc.isDestroyed()) {
				invalid.push(id);
				continue;
			}
			wc.send(storageUpdateChannel(this.name, key), this.data[key]);
		} catch {
			invalid.push(id);
		}
		for (const id of invalid) this.rendererIds.delete(id);
	}
};
function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function readFileSyncSafe(path) {
	try {
		return (0, node_fs.readFileSync)(path, "utf-8");
	} catch (err) {
		if (err.code === "ENOENT") return null;
		throw err;
	}
}
function isStoredShape(value) {
	if (typeof value !== "object" || value === null) return false;
	const v = value;
	return typeof v.version === "number" && typeof v.data === "object" && v.data !== null && !Array.isArray(v.data);
}
/**
* Storage IPC wiring: importing this module (via `cross-window-state/main`)
* registers the storage handlers once the app is ready.
*
* - `cws:storage:get` (sendSync): creates the store on first call using the
*   renderer-supplied defaults/version/options, then returns the merged
*   state. Configuration errors surface as `null` so renderers can fall
*   back to their defaults.
* - `cws:storage:set` (send, fire-and-forget): applies a patch. A set for an
*   unknown store logs a warning instead of silently dropping the write
*   (get must come first — that is how the store learns its config).
*/
function setupStorageIpc() {
	electron.ipcMain.on(channel.storageGet, (event, name, payload) => {
		try {
			event.returnValue = new StorageStore(name, payload.defaults, payload.version, payload.options).getByRenderer(event.sender.id);
		} catch (err) {
			console.error(`[cws] storage get failed for "${name}":`, err);
			event.returnValue = null;
		}
	});
	electron.ipcMain.on(channel.storageSet, (_event, name, patch, key) => {
		const store = StorageStore.instances.get(name);
		if (!store) {
			console.warn(`[cws] storage set for unknown store "${name}" ignored — get() must create it first.`);
			return;
		}
		store.setByRenderer(patch, key);
	});
}
electron.app.whenReady().then(setupStorageIpc);
electron.app.on("will-quit", () => {
	for (const store of StorageStore.instances.values()) store.flushSync();
});
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
var RuntimeStateManager = class {
	states = /* @__PURE__ */ new Map();
	rendererIds = /* @__PURE__ */ new Map();
	mainRefs = /* @__PURE__ */ new Map();
	constructor() {
		electron.app.whenReady().then(() => this.setupIpc());
	}
	setupIpc() {
		electron.ipcMain.on(channel.runtimeGet, (event, key) => {
			this.registerRenderer(key, event.sender.id);
			event.returnValue = this.states.get(key)?.value;
		});
		electron.ipcMain.on(channel.runtimeSet, (_event, key, value) => {
			this.set(key, value);
		});
		electron.ipcMain.on(channel.runtimeClear, (event, key) => {
			this.unregisterRenderer(key, event.sender.id);
		});
	}
	/**
	* Main-process acquire: bump the ref count. The first acquire creates the
	* signal with `defaultValue`; later acquires reuse the live value.
	*/
	acquire(name, defaultValue) {
		let signal = this.states.get(name);
		if (!signal) {
			signal = createSignal(defaultValue);
			this.states.set(name, signal);
		}
		this.mainRefs.set(name, (this.mainRefs.get(name) ?? 0) + 1);
		return signal;
	}
	/** Main-process release. When the last ref drops, the state may be freed. */
	release(name) {
		const refs = (this.mainRefs.get(name) ?? 0) - 1;
		if (refs > 0) {
			this.mainRefs.set(name, refs);
			return;
		}
		this.mainRefs.delete(name);
		this.maybeCleanup(name);
	}
	/** Current value for `name`, or undefined when absent/cleared. */
	get(name) {
		return this.states.get(name)?.value;
	}
	/**
	* Set (or create) a state and broadcast to subscribed renderers.
	* `set(name, undefined)` clears the entry but still broadcasts
	* `{ newValue: undefined }` so renderers converge.
	*/
	set(name, value) {
		let signal = this.states.get(name);
		if (!signal) {
			signal = createSignal(value);
			this.states.set(name, signal);
		}
		const oldValue = signal.value;
		signal.set(value);
		if (value === void 0) this.states.delete(name);
		this.broadcast(name, {
			key: name,
			newValue: value,
			oldValue
		});
	}
	registerRenderer(key, senderId) {
		const ids = this.rendererIds.get(key);
		if (!ids) this.rendererIds.set(key, [senderId]);
		else if (!ids.includes(senderId)) ids.push(senderId);
	}
	unregisterRenderer(key, senderId) {
		const ids = this.rendererIds.get(key);
		if (!ids) return;
		const next = ids.filter((id) => id !== senderId);
		if (next.length === 0) {
			this.rendererIds.delete(key);
			this.maybeCleanup(key);
		} else this.rendererIds.set(key, next);
	}
	maybeCleanup(key) {
		const hasMainRef = this.mainRefs.has(key);
		const renderers = this.rendererIds.get(key);
		if (!hasMainRef && (!renderers || renderers.length === 0)) {
			this.states.delete(key);
			this.rendererIds.delete(key);
		}
	}
	broadcast(key, payload) {
		const ids = this.rendererIds.get(key);
		if (!ids || ids.length === 0) return;
		const invalid = [];
		for (const id of ids) try {
			const wc = electron.webContents.fromId(id);
			if (!wc || wc.isDestroyed()) {
				invalid.push(id);
				continue;
			}
			wc.send(runtimeUpdateChannel(key), payload);
		} catch {
			invalid.push(id);
		}
		if (invalid.length > 0) this.rendererIds.set(key, (this.rendererIds.get(key) ?? []).filter((id) => !invalid.includes(id)));
	}
};
/** Process-wide singleton used by `createRuntimeState` (main). */
var runtimeStateManager = new RuntimeStateManager();
function createRuntimeState(name, defaultValue, options) {
	const signal = runtimeStateManager.acquire(name, defaultValue);
	let destroyed = false;
	const offs = [];
	return {
		get state() {
			return signal.value;
		},
		set(value) {
			if (destroyed) {
				console.error(`[cws] RuntimeState("${name}") was destroyed; set() is ignored.`);
				return;
			}
			if (options?.readonly) {
				console.error(`[cws] RuntimeState("${name}") is readonly; set() is rejected.`);
				return;
			}
			runtimeStateManager.set(name, value);
		},
		watch(cb) {
			if (destroyed) {
				console.error(`[cws] RuntimeState("${name}") was destroyed; watch() is ignored.`);
				return () => {};
			}
			const off = signal.subscribe(cb);
			offs.push(off);
			return off;
		},
		destroy() {
			if (destroyed) {
				console.error(`[cws] RuntimeState("${name}") is already destroyed.`);
				return;
			}
			destroyed = true;
			for (const off of offs) off();
			offs.length = 0;
			runtimeStateManager.release(name);
		}
	};
}
/**
* Create (or reuse) a persistent store. Same name+version+defaults returns
* the live instance; a different version migrates and rebuilds.
*/
function createStorageState(name, defaults, version, options) {
	return new StorageStore(name, defaults, version, options);
}
//#endregion
//#region src/main/index.ts
if (process.env.CWS_USER_DATA) electron.app.setPath("userData", process.env.CWS_USER_DATA);
var counter = createRuntimeState("counter", 0);
var settings = createStorageState("settings", {
	theme: "light",
	notifications: true
}, 1);
counter.watch((v) => console.log("[main] counter =", v));
settings.watch("theme", (v) => console.log("[main] settings.theme =", v));
function createWindow() {
	const win = new electron.BrowserWindow({
		width: 460,
		height: 420,
		title: "cross-window-state demo",
		webPreferences: {
			preload: (0, node_path.join)(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true
		}
	});
	win.loadFile((0, node_path.join)(__dirname, "../renderer/index.html")).catch(() => {
		win.loadURL("http://localhost:5173");
	});
}
electron.ipcMain.handle("demo:open-window", () => {
	createWindow();
});
electron.app.whenReady().then(() => {
	createWindow();
	createWindow();
});
electron.app.on("window-all-closed", () => {
	electron.app.quit();
});
//#endregion
