# Errors

The dispatcher never rejects. Electron's `ipcMain.handle` collapses a thrown error into its
message and drops everything else, so results travel as `{ ok: true, value }` or
`{ ok: false, error }` and the renderer proxy rebuilds the error before throwing it.

```ts
import { PluginError } from 'capacitron';

try {
  await Database.query('select 1');
} catch (error) {
  if (error instanceof PluginError && error.code === 'DB_LOCKED') retryLater();
}
```

## Codes

| `code`              | Raised when                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `INVALID_ARGUMENT`  | an argument failed its input schema (`issues` carries the zod issues) |
| `OUTPUT_INVALID`    | a return value failed its output schema                               |
| `UNKNOWN_PLUGIN`    | no plugin by that name is registered                                  |
| `UNKNOWN_METHOD`    | the plugin has no such method                                         |
| `FORBIDDEN`         | `canInvoke` refused the call                                          |
| `HOST_UNAVAILABLE`  | no preload host and no `web` fallback                                 |
| `PROTOCOL_MISMATCH` | the reply was not an envelope — mismatched capacitron versions        |
| `PLUGIN_ERROR`      | anything else a plugin threw                                          |

## Throwing your own

```ts
throw new PluginError('database is locked', { code: 'DB_LOCKED', data: { retryable: true } });
```

## What survives the crossing

`name`, `message`, `code`, `issues` and `data` all survive; `error.cause` survives one level deep.

What does _not_ survive is the prototype. A `ZodError` arrives as a `PluginError` with
`name === 'ZodError'` and its `issues` intact, not as a real `ZodError`. Rebuilding zod instances
would tie your renderer to zod's constructor shape. Check `code`.

## Output validation

Return values are parsed against `output` before they cross. Turn it off with
`validateOutput: false`. Two consequences worth knowing:

- zod object schemas strip undeclared keys, so your schema becomes the literal wire contract.
  Good — an internal field cannot leak by accident — but an under-declared schema silently drops
  fields.
- It replaces Electron's opaque `An object could not be cloned` with a `code` and the offending
  path.

## Restricting callers

`canInvoke` decides which windows may call at all. It runs before dispatch and refusal produces a
`FORBIDDEN` error.

```ts
registerPluginBridge(plugins, {
  canInvoke: (sender) => sender.getURL().startsWith('app://'),
});
```
