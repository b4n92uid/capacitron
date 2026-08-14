# Bundler notes

Entries are isolated on purpose:

- `capacitron/renderer` contains no `electron` import and no `window` reference (it reads
  `globalThis`), so it is safe in a browser build, a worker or a Node test.
- `capacitron/preload` pulls no zod, so a sandboxed preload stays small.
- `capacitron` (the isomorphic entry) uses zod for types only, so it adds no runtime zod to the
  renderer.

## electron-vite

`externalizeDepsPlugin()` externalizes everything in `dependencies`, and an externalized
`require()` fails inside a **sandboxed** preload. Either bundle capacitron into the preload:

```ts
preload: {
  plugins: [externalizeDepsPlugin({ exclude: ['capacitron'] })],
}
```

or keep `sandbox: false` on the window.

## tsconfig layout

Keep the main-side program and the renderer-side program separate:

- `web.ts` files belong to your renderer tsconfig
- `electron.ts` files to your node one
- `definitions.ts` to both

That split is what stops renderer code from importing `electron` by accident.
