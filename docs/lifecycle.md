# Lifecycle

Register teardown from inside `create()`:

```ts
create(ctx) {
  const db = openDatabase(ctx.userDataPath);
  ctx.onDestroy(() => db.close());
  return { /* … */ };
}
```

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
