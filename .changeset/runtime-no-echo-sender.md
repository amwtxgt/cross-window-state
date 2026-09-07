---
"cross-window-state": patch
---

Fix: runtime updates are no longer echoed back to the originating renderer. The main-process broadcast used to include the sender, and since the IPC round-trip deserializes to a fresh reference, the renderer-side `Object.is` guard could not de-duplicate it — every `set()` fired watchers **twice** on the writing page (the optimistic local fire plus the echo). The broadcast now skips the sender, matching web-mode semantics (BroadcastChannel never delivers a message back to the posting context); the writing page still gets exactly one delivery from its own optimistic local fire, and main-process sets (which have no originating renderer) still reach every window.
