# Writing a plugin

A plugin is three files, one per side.

`definitions.ts` imports zod and nothing else. That is what lets it compile into the main bundle
and the renderer bundle at once, so the two halves cannot drift on the wire name or the shape.

## 1. `definitions.ts` — isomorphic

```ts
import { z } from 'zod';
import { definePluginSchema, type PluginInterface } from 'capacitron';

export const PLUGIN_NAME = 'clipboard';

export const PLUGIN_SCHEMA = definePluginSchema({
  read: { input: [], output: z.string() },
  write: { input: [z.string()], output: z.void() },
});

export type ClipboardPlugin = PluginInterface<typeof PLUGIN_SCHEMA>;
```

`input` is positional: one schema per argument, in order.

## 2. `electron.ts` — main process

```ts
import { clipboard } from 'electron';
import { definePlugin } from 'capacitron';
import { PLUGIN_NAME, PLUGIN_SCHEMA } from './definitions';

export const clipboardPlugin = definePlugin({
  name: PLUGIN_NAME,
  schema: PLUGIN_SCHEMA,
  create() {
    return {
      async read() {
        return clipboard.readText();
      },
      async write(text) {
        clipboard.writeText(text);
      },
    };
  },
});
```

Per-plugin state lives in the `create()` closure.

## 3. `web.ts` — renderer

```ts
import { registerPlugin } from 'capacitron/renderer';
import { PLUGIN_NAME, type ClipboardPlugin } from './definitions';

export const Clipboard = registerPlugin<ClipboardPlugin>(PLUGIN_NAME);
```

## Then register and call it

Add the plugin to the registry array, then call it from anywhere in the renderer. No `window`, no
channel names, no IPC:

```ts
import { Clipboard } from '../plugins/clipboard/web';

await Clipboard.write('hello');
```

Adding a method to `PLUGIN_SCHEMA` is a compile error in `electron.ts` until you implement it, and
is immediately typed on the renderer proxy.

## Host context

Extra host services are typed through the whole registry and reach every plugin's `create(ctx)`:

```ts
registerPluginBridge(plugins, {
  context: { userDataPath: app.getPath('userData'), appVersion: app.getVersion() },
});
```

The default context is `{ userDataPath: app.getPath('userData') }`.

## Compared to Capacitor

| Capacitor                                               | capacitron                |
| ------------------------------------------------------- | ------------------------- |
| `registerPlugin<T>('Name')`                             | same name, same signature |
| `registerPlugin(n, { web: … })`                         | same, lazy and cached     |
| `addListener(event, cb): Promise<PluginListenerHandle>` | same, with `.remove()`    |
| `definitions.ts` / `web.ts` file convention             | same                      |
| `checkPermissions` / `requestPermissions`               | not present               |

## Next

- [Events](./events.md)
- [Lifecycle](./lifecycle.md)
- [Web fallback](./web-fallback.md)
