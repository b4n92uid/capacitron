# API

## `capacitron` — isomorphic

Safe in main, preload-adjacent code and renderer. Imports zod for types only.

`definePluginSchema` · `definePluginEvents` · `definePlugin` · `PluginInterface` ·
`PluginMethods` · `PluginEmitter` · `PluginListenerHandle` · `PluginContext` ·
`BaseHostContext` · `ElectronPlugin` · `PluginError` · `serializePluginError` ·
`deserializePluginError` · `isSerializedPluginError` · `DEFAULT_NAMESPACE` · `pluginChannels`

## `capacitron/main`

```ts
registerPluginBridge<TContext>(
  plugins: ReadonlyArray<ElectronPlugin<TContext>>,
  options?: {
    context?: TContext;        // default { userDataPath: app.getPath('userData') }
    namespace?: string;        // default 'capacitron'
    autoDispose?: boolean;     // default true
    validateOutput?: boolean;  // default true
    canInvoke?(sender: WebContents, plugin: string, method: string): boolean;
  },
): { dispose(): Promise<void>; channels: { invoke: string; event: string } };
```

Re-exports everything from `capacitron`.

## `capacitron/preload`

```ts
exposePluginHost(options?: { namespace?: string; maxPendingPerEvent?: number }): void;
createPluginHost(options?): PluginHost & { dispose(): void };
```

`createPluginHost` is for apps that already expose a composite API object under their own key —
see [Namespace and `window` typing](./configuration.md).

## `capacitron/renderer`

```ts
registerPlugin<T>(name: string, options?: { web?: () => T | Promise<T> }): T;
setPluginNamespace(namespace: string): void;
```

Re-exports everything from `capacitron`.

## `capacitron/global`

Ambient `Window.capacitron` declaration for the default namespace. Import for side effects only.

```ts
import 'capacitron/global';
```
