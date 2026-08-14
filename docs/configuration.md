# Namespace and `window` typing

The namespace names both IPC channels and the `contextBridge` key. Default `capacitron`.

## Changing it

Change it in all three places:

```ts
registerPluginBridge(plugins, { namespace: 'acme' }); // main
exposePluginHost({ namespace: 'acme' }); // preload
setPluginNamespace('acme'); // renderer, before the first plugin call
```

`setPluginNamespace` must run before the first plugin **call**, not before the first
`registerPlugin()` — proxies resolve the host lazily on every call.

## Typing `window`

On the default namespace, import the opt-in declaration:

```ts
// src/env.d.ts
import 'capacitron/global';
```

On a custom namespace, write it yourself:

```ts
// src/global.d.ts
import type { PluginHost } from 'capacitron/renderer';

export {};

declare global {
  interface Window {
    acme?: PluginHost;
  }
}
```

capacitron ships no unconditional ambient declaration: it would leak into every consuming program
and be wrong for anyone on a custom namespace.

## Exposing the host under your own key

If your app already exposes one composite API object, build the host and mount it yourself instead
of calling `exposePluginHost`:

```ts
import { contextBridge } from 'electron';
import { createPluginHost } from 'capacitron/preload';

const host = createPluginHost({ namespace: 'acme' });

contextBridge.exposeInMainWorld('acme', {
  ...myOtherApi,
  invoke: host.invoke,
  addListener: host.addListener,
});
```

`invoke` and `addListener` must sit at the top level of the exposed object — that is where the
renderer proxy looks. Leave `dispose` out, as `exposePluginHost` does: the renderer has no reason
to tear down its own bridge.
