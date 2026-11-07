# Lifecycle

Register teardown from inside `create()`:

```ts
create(ctx) {
  const db = openDatabase(ctx.userDataPath);
  ctx.onDestroy(() => db.close());
  return { /* … */ };
}
```

## Init

`init(ctx)` is an optional async hook for setup that needs the app to be ready. It receives the
same `ctx` as `create()`.

```ts
definePlugin({
  name: 'library',
  schema,
  create(ctx) {
    return {/* … */};
  },
  async init(ctx) {
    await openIndex(ctx.userDataPath);
    ctx.onDestroy(() => closeIndex());
  },
});
```

- It runs after `app.whenReady()`, one plugin at a time, in registry order. Each is awaited.
- A plugin that throws is logged and skipped. The others still run.
- IPC calls wait for every `init` to finish. `bridge.ready` resolves at the same point and never
  rejects.
- `ctx.onDestroy` callbacks registered in `init` run at teardown like any other.

When the bridge is registered at the top level of the main module, `create()` runs before the app
is ready. Put pre-ready APIs there, such as `protocol.registerSchemesAsPrivileged`. Keep `create()`
to in-memory setup and move the rest to `init`.

## Teardown order

Plugins run in reverse registration order, and callbacks run LIFO within a plugin. Each one is
awaited.

Failures are collected and thrown together as an `AggregateError` — one bad teardown cannot strand
the rest.

## autoDispose

`autoDispose` is on by default. It hooks `before-quit`, the last event that can still be
cancelled, which is the only way async teardown actually finishes. There is no quit handler for
you to write.

Turn it off if you already orchestrate shutdown yourself:

```ts
const bridge = registerPluginBridge(plugins, { autoDispose: false });

// later, in your own shutdown path
await bridge.dispose();
```
