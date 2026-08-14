# capacitron

Capacitor's plugin model, for Electron.

Every native capability lives in its own three-file plugin. Calls cross **one** IPC channel,
validated against a zod schema that also generates the TypeScript interface both sides use.
Your `main.ts` gains one line and your `preload.ts` is two lines, forever — however many plugins
you add.

```ts
// renderer
await Clipboard.write('hello');
const handle = await Ticker.addListener('tick', ({ n }) => console.log(n));
```

## Requirements

| Requires | Version     |
| -------- | ----------- |
| Node     | 20 or newer |
| Electron | 28 or newer |
| zod      | 4           |

The window must run with `contextIsolation: true` and `nodeIntegration: false`.

## Install

```sh
pnpm add capacitron zod
```

`zod` is a peer dependency: your schemas and capacitron's validator must be the same copy.
`electron` is an optional peer — a renderer-only or web-only consumer legitimately has none.

## Setup

Three files, once. After this, adding a plugin means adding one line to the registry.

Each step says which process the file belongs to. Getting this wrong is the usual first error:
main-process code cannot touch `window`, and renderer code cannot import `electron`.

| Step | File         | Process                          |
| ---- | ------------ | -------------------------------- |
| 1    | `preload.ts` | preload (bridge between the two) |
| 2    | `plugins.ts` | main                             |
| 3    | `main.ts`    | main                             |
| 4    | `env.d.ts`   | renderer                         |

### 1. Preload — preload script

Runs in the renderer process but in its own isolated context, with access to `electron`. It is the
only file that touches both sides.

```ts
// electron/preload.ts
import { exposePluginHost } from 'capacitron/preload';

exposePluginHost();
```

That is the whole preload. It never grows.

### 2. Registry — main process

A plain array — the one place a capability is listed, and it stays statically analysable.

```ts
// electron/plugins.ts
import type { ElectronPlugin } from 'capacitron';
import { clipboardPlugin } from '../plugins/clipboard/electron';

export const plugins: ReadonlyArray<ElectronPlugin> = [clipboardPlugin];
```

Only main-process code imports these files: a plugin's `electron.ts` pulls in `electron`, so the
registry must never be imported from the renderer.

### 3. Main — main process

```ts
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerPluginBridge } from 'capacitron/main';
import { plugins } from './plugins';

function createWindow(): void {
  new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
  }).loadURL(process.env['VITE_DEV_SERVER_URL'] ?? 'app://bundle/index.html');
}

void app.whenReady().then(() => {
  registerPluginBridge(plugins); // <- the whole integration
  createWindow();
});
```

Call `registerPluginBridge` before the first window loads, so no call can arrive unhandled.
There is no quit handler to write: `autoDispose` installs its own and awaits your plugins'
teardown before the process exits.

### 4. Type `window` (optional) — renderer

Add the ambient declaration once, in your renderer program, on the default namespace:

```ts
// src/env.d.ts
import 'capacitron/global';
```

Setup is done. Next: [write your first plugin](./docs/writing-plugins.md) — a plugin is three
files, one per process.

## Documentation

| Guide                                                    | Covers                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| [Writing a plugin](./docs/writing-plugins.md)            | the three-file layout, schemas, host context, Capacitor parity |
| [Events](./docs/events.md)                               | declaring, emitting, subscribing, cold-start replay            |
| [Lifecycle](./docs/lifecycle.md)                         | `onDestroy`, teardown order, `autoDispose`                     |
| [Errors](./docs/errors.md)                               | `PluginError`, error codes, output validation, `canInvoke`     |
| [Web fallback](./docs/web-fallback.md)                   | running the same code without an Electron host                 |
| [Namespace and `window` typing](./docs/configuration.md) | changing the namespace, custom bridge keys                     |
| [Bundler notes](./docs/bundlers.md)                      | electron-vite, sandboxed preloads, tsconfig split              |
| [API](./docs/api.md)                                     | every export, per entry point                                  |
| [Migration](./docs/migration.md)                         | replacing a hand-rolled bridge                                 |

## License

MIT
