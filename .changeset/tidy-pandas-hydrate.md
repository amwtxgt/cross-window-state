---
"cross-window-state": patch
---

fix(web): late-joining tabs now hydrate runtime state from live peers. Previously a tab opened after a runtime value was set sat on its default until the next write; subscribing with no local value now broadcasts a hydrate request and any tab holding the value answers. Memory-only semantics are unchanged — nothing is persisted.
