# Events

Declare events in `definitions.ts`, emit them from `create()`, subscribe with a Capacitor-shaped
handle.

```ts
// definitions.ts
export const PLUGIN_EVENTS = definePluginEvents({ tick: z.object({ n: z.number() }) });
export type TickerPlugin = PluginInterface<typeof PLUGIN_SCHEMA, typeof PLUGIN_EVENTS>;

// electron.ts
create(ctx) {
  let n = 0;
  const id = setInterval(() => ctx.emit('tick', { n: n++ }), 1000);
  ctx.onDestroy(() => clearInterval(id));
  return { async now() { return n; } };
}

// renderer
const handle = await Ticker.addListener('tick', ({ n }) => console.log(n));
await handle.remove();
```

`ctx.emit` is bound to the plugin's own name, so no plugin can emit as another.

## Replay

The preload attaches long before your framework boots. An event pushed in that gap is queued per
`plugin:event` key and replayed to the first subscriber, so a cold-start callback (a login
redirect, a launch URL) is not lost.

The queue holds the last `maxPendingPerEvent` payloads (default 50) and is drained by the first
`addListener`.

```ts
exposePluginHost({ maxPendingPerEvent: 10 });
```

## The limit: no window, no event

Events are broadcast to every live window. Emitted with _no_ window open, an event is dropped —
the bridge is usually built in `whenReady`, before any window exists.

A plugin whose event can precede the first window must also expose a pull method for it:

```ts
async getLaunchUrl() {
  const url = pending;
  pending = undefined;
  return url ? { url } : null;
}
```

The renderer then calls `getLaunchUrl()` once on boot and subscribes for later occurrences.
