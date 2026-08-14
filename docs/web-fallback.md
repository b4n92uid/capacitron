# Web fallback

Give a plugin a browser implementation for the case where there is no Electron host — a web build,
a Storybook, a test.

```ts
export const Clipboard = registerPlugin<ClipboardPlugin>(PLUGIN_NAME, {
  web: () => import('./web-impl').then((m) => m.ClipboardWeb),
});
```

The fallback is used only when no host is present. The factory is never evaluated under Electron,
so it stays a separate chunk; when it is used, it resolves once and is cached.

`addListener` delegates to the implementation's own, which must return a `PluginListenerHandle` —
so subscription code reads identically on both paths.

Without a `web` option and without a host, a call fails with `HOST_UNAVAILABLE`.
