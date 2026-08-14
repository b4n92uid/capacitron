# Migrating from an inline bridge

If you already have a hand-rolled dispatcher of this shape, the swap is mechanical.

1. Delete your `types.ts`, `bridge.ts` and `register-plugin.ts`. Import from `capacitron`,
   `capacitron/main` and `capacitron/renderer` instead.
2. Replace the body of `preload.ts` with `exposePluginHost()`.
3. Keep your registry array and your `main.ts` window logic — they are yours, not framework.
4. Move any teardown method to `ctx.onDestroy(...)` and delete the quit handler that called it.
   Watch for a plugin exposing a renderer-callable `close()`: a duck-typed dispose would have been
   calling it on quit, and now will not.
5. Turn output validation on and check your schemas — an under-declared object schema now strips
   the fields it does not mention.

## Things that change behaviour

| Before                                | After                                                     |
| ------------------------------------- | --------------------------------------------------------- |
| errors arrive as message-only strings | typed `PluginError` with `code`, `data`, `issues`         |
| any `WebContents` can call            | `canInvoke` can refuse, raising `FORBIDDEN`               |
| return values cross unchecked         | parsed against `output`, undeclared keys stripped         |
| events pushed before boot are lost    | queued per event key and replayed to the first subscriber |
| teardown fires and is not awaited     | awaited, reverse order, failures aggregated               |
