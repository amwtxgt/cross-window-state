//#region ../../dist/utils-DhHC_Pkl.mjs
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
//#region ../../dist/storage-state-CQ3uxZh9.mjs
var BUS_CHANNEL = "cws:bus";
var STORAGE_PREFIX = "cws:";
var runtimeEntries = /* @__PURE__ */ new Map();
var storageEntries = /* @__PURE__ */ new Map();
var busChannel;
function getBusChannel() {
	if (busChannel !== void 0) return busChannel;
	try {
		const ch = new BroadcastChannel(BUS_CHANNEL);
		ch.onmessage = (event) => {
			applyBusMessage(event.data);
		};
		busChannel = ch;
	} catch {
		busChannel = null;
	}
	return busChannel;
}
function postBus(message) {
	const ch = getBusChannel();
	if (ch) try {
		ch.postMessage(message);
	} catch {}
}
if (typeof window === "undefined" || typeof window.__crossWindowState__ === "undefined") getBusChannel();
function applyBusMessage(raw) {
	if (!raw || typeof raw !== "object") return;
	const msg = raw;
	if (msg.kind === "runtime" && typeof msg.name === "string") applyRuntime(msg.name, msg.value);
	else if (msg.kind === "storage" && typeof msg.name === "string" && typeof msg.patch === "object" && msg.patch !== null) applyStoragePatch(msg.name, msg.patch);
}
function runtimeEntryOf(key) {
	let entry = runtimeEntries.get(key);
	if (!entry) {
		entry = {
			value: void 0,
			listeners: /* @__PURE__ */ new Set()
		};
		runtimeEntries.set(key, entry);
	}
	return entry;
}
function applyRuntime(key, value) {
	const entry = runtimeEntryOf(key);
	const oldValue = entry.value;
	entry.value = value;
	for (const cb of [...entry.listeners]) cb({
		key,
		newValue: value,
		oldValue
	});
}
var localRuntimeBus = {
	get(key) {
		return runtimeEntries.get(key)?.value;
	},
	set(key, value) {
		applyRuntime(key, value);
		postBus({
			kind: "runtime",
			name: key,
			value
		});
	},
	/** Local-page teardown only: notify own listeners with undefined, drop the
	*  entry. Never broadcast — other tabs keep their state. */
	clear(key) {
		const entry = runtimeEntries.get(key);
		if (!entry) return;
		const oldValue = entry.value;
		entry.value = void 0;
		for (const cb of [...entry.listeners]) cb({
			key,
			newValue: void 0,
			oldValue
		});
		runtimeEntries.delete(key);
	},
	onStateUpdated(key, cb) {
		const entry = runtimeEntryOf(key);
		entry.listeners.add(cb);
		return () => {
			entry.listeners.delete(cb);
		};
	}
};
function getStorage() {
	try {
		return typeof window !== "undefined" ? window.localStorage : null;
	} catch {
		return null;
	}
}
function readPersisted(name) {
	try {
		const storage = getStorage();
		if (!storage) return null;
		const raw = storage.getItem(STORAGE_PREFIX + name);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || typeof parsed.version !== "number" || typeof parsed.data !== "object" || parsed.data === null) return null;
		return parsed;
	} catch {
		return null;
	}
}
function persistEntry(name, entry) {
	try {
		const storage = getStorage();
		if (!storage) return;
		storage.setItem(STORAGE_PREFIX + name, JSON.stringify({
			version: entry.version,
			data: entry.data
		}));
	} catch {}
}
function storageEntryOf(name) {
	let entry = storageEntries.get(name);
	if (!entry) {
		const persisted = readPersisted(name);
		entry = {
			version: persisted?.version ?? 0,
			data: { ...persisted?.data ?? {} },
			keyListeners: /* @__PURE__ */ new Map()
		};
		storageEntries.set(name, entry);
	}
	return entry;
}
function notifyStorageKey(entry, key) {
	const listeners = entry.keyListeners.get(key);
	if (!listeners) return;
	for (const cb of [...listeners]) cb(entry.data[key]);
}
function applyStoragePatch(name, patch) {
	const entry = storageEntryOf(name);
	entry.data = {
		...entry.data,
		...patch
	};
	persistEntry(name, entry);
	for (const key of Object.keys(patch)) notifyStorageKey(entry, key);
}
var localStorageBus = {
	/**
	* Merge persisted data over defaults when versions match; on mismatch,
	* fall back to defaults and repair the disk with the new version (the web
	* mode has no migration chain — there is no main process to run one).
	*/
	get(name, options) {
		const persisted = readPersisted(name);
		if (persisted && persisted.version === options.version) {
			const data = {
				...options.defaults,
				...persisted.data
			};
			const entry = storageEntryOf(name);
			entry.version = options.version;
			entry.data = { ...data };
			return { ...data };
		}
		const data = { ...options.defaults };
		const entry = storageEntryOf(name);
		entry.version = options.version;
		entry.data = { ...data };
		persistEntry(name, entry);
		return { ...data };
	},
	set(name, patch, key) {
		const normalized = key !== void 0 ? { [key]: patch[key] } : { ...patch };
		applyStoragePatch(name, normalized);
		postBus({
			kind: "storage",
			name,
			patch: normalized
		});
	},
	onStateUpdated(name, key, cb) {
		const entry = storageEntryOf(name);
		let listeners = entry.keyListeners.get(key);
		if (!listeners) {
			listeners = /* @__PURE__ */ new Set();
			entry.keyListeners.set(key, listeners);
		}
		listeners.add(cb);
		return () => {
			listeners.delete(cb);
		};
	}
};
/**
* Host detection: pick the Electron preload bridge when present, otherwise
* fall back to the web-mode local bus. Evaluated once at module load — the
* preload injects `window.__crossWindowState__` before any page script runs,
* so the choice is stable for the page lifetime.
*
* Both bus shapes satisfy the same interfaces; the payload protocol is
* identical (runtime updates arrive as {key,newValue,oldValue}, storage
* updates as bare values on a key-level channel).
*/
function detect() {
	if (typeof window !== "undefined" && window.__crossWindowState__) return window.__crossWindowState__;
	return {
		runtime: localRuntimeBus,
		storage: localStorageBus
	};
}
var bridge = detect();
var cache$1 = /* @__PURE__ */ new Map();
function createRuntimeState(name, defaultValue, options) {
	const existing = cache$1.get(name);
	if (existing) return existing;
	let current = bridge.runtime.get(name) ?? defaultValue;
	let destroyed = false;
	const watchers = /* @__PURE__ */ new Set();
	const offBridge = bridge.runtime.onStateUpdated(name, ({ newValue }) => {
		if (destroyed) return;
		if (Object.is(newValue, current)) return;
		const old = current;
		current = newValue;
		for (const cb of [...watchers]) cb(current, old);
	});
	const state = {
		get state() {
			return current;
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
			const old = current;
			current = value;
			bridge.runtime.set(name, value);
			for (const cb of [...watchers]) cb(value, old);
		},
		watch(cb) {
			if (destroyed) {
				console.error(`[cws] RuntimeState("${name}") was destroyed; watch() is ignored.`);
				return () => {};
			}
			watchers.add(cb);
			return () => {
				watchers.delete(cb);
			};
		},
		destroy() {
			if (destroyed) {
				console.error(`[cws] RuntimeState("${name}") is already destroyed.`);
				return;
			}
			destroyed = true;
			watchers.clear();
			offBridge();
			cache$1.delete(name);
			bridge.runtime.clear(name);
		}
	};
	cache$1.set(name, state);
	return state;
}
var cache = /* @__PURE__ */ new Map();
function createStorageState(name, defaults, version, options) {
	const existing = cache.get(name);
	if (existing && existing.version === version) return existing.state;
	if (existing) existing.state.destroy();
	let raw;
	const fetched = bridge.storage.get(name, {
		defaults,
		version,
		options
	});
	if (fetched === null || typeof fetched !== "object") raw = { ...defaults };
	else raw = fetched;
	const data = raw;
	let destroyed = false;
	const keyWatchers = /* @__PURE__ */ new Map();
	const keySubs = /* @__PURE__ */ new Map();
	function notifyKey(key) {
		const watchers = keyWatchers.get(key);
		if (!watchers) return;
		for (const cb of [...watchers]) cb(data[key]);
	}
	function ensureSubscribed(key) {
		if (keySubs.has(key)) return;
		const off = bridge.storage.onStateUpdated(name, key, (value) => {
			if (destroyed) return;
			if (Object.is(value, data[key])) return;
			data[key] = value;
			notifyKey(key);
		});
		keySubs.set(key, off);
	}
	for (const key of Object.keys(defaults)) ensureSubscribed(key);
	function applyLocalChange(key, deleteKey) {
		if (destroyed) {
			console.error(`[cws] StorageState("${name}") was destroyed; write is ignored.`);
			return;
		}
		ensureSubscribed(key);
		if (deleteKey) {
			delete data[key];
			bridge.storage.set(name, { [key]: void 0 }, key);
		} else bridge.storage.set(name, { [key]: data[key] }, key);
		notifyKey(key);
	}
	const proxy = createProxyState(data, (key) => applyLocalChange(key, false), (key) => applyLocalChange(key, true));
	const state = {
		get state() {
			return proxy;
		},
		set(keyOrPatch, value) {
			if (typeof keyOrPatch === "string") {
				data[keyOrPatch] = value;
				applyLocalChange(keyOrPatch, false);
			} else for (const [key, val] of Object.entries(keyOrPatch)) {
				data[key] = val;
				applyLocalChange(key, false);
			}
		},
		watch(key, cb) {
			if (destroyed) {
				console.error(`[cws] StorageState("${name}") was destroyed; watch() is ignored.`);
				return () => {};
			}
			ensureSubscribed(key);
			let watchers = keyWatchers.get(key);
			if (!watchers) {
				watchers = /* @__PURE__ */ new Set();
				keyWatchers.set(key, watchers);
			}
			const wrapped = cb;
			watchers.add(wrapped);
			return () => {
				watchers.delete(wrapped);
			};
		},
		destroy() {
			if (destroyed) {
				console.error(`[cws] StorageState("${name}") is already destroyed.`);
				return;
			}
			destroyed = true;
			for (const off of keySubs.values()) off();
			keySubs.clear();
			keyWatchers.clear();
			if (cache.get(name)?.state === state) cache.delete(name);
		}
	};
	cache.set(name, {
		version,
		state
	});
	return state;
}
//#endregion
//#region src/renderer/index.ts
var counter = createRuntimeState("counter", 0);
var settings = createStorageState("settings", {
	theme: "light",
	notifications: true
}, 1);
function el(id) {
	return document.getElementById(id);
}
function render() {
	el("count").textContent = String(counter.state);
	el("theme").value = String(settings.state.theme);
	el("notifications").checked = Boolean(settings.state.notifications);
	el("settings-view").textContent = JSON.stringify(settings.state);
}
el("inc").addEventListener("click", () => {
	counter.set(counter.state + 1);
});
el("destroy").addEventListener("click", () => {
	counter.destroy();
});
el("theme").addEventListener("change", (e) => {
	settings.set("theme", e.target.value);
});
el("notifications").addEventListener("change", (e) => {
	settings.set("notifications", e.target.checked);
});
var demo = window.__demo__;
if (demo) {
	const btn = el("open-window");
	btn.hidden = false;
	btn.addEventListener("click", () => demo.openWindow());
}
counter.watch(render);
settings.watch("theme", render);
settings.watch("notifications", render);
render();
//#endregion
