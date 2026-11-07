# Changelog

## 0.2.0

- Optional `init(ctx)` hook per plugin: runs after app ready, one at a time, in registry order.
- `bridge.ready` promise, resolved when every `init` has run.
- IPC calls wait for init.
- The default `userDataPath` is read on access, so a plugin's `create()` can change it first.

## 0.1.0

First release.

- Single-channel IPC dispatcher with per-argument and per-return zod validation.
- `registerPlugin<T>(name)` renderer proxy with a Capacitor-shaped `addListener`.
- `exposePluginHost()` preload helper, including the bounded pre-subscription event replay queue.
- `ctx.onDestroy` teardown, awaited on `before-quit` via `autoDispose`.
- Errors cross IPC as a typed envelope: `code`, `issues` and `data` survive intact.
- Optional `web` fallback for running the same renderer code without a preload.
