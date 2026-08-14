import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/main.ts', 'src/preload.ts', 'src/renderer.ts', 'src/global.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // Each entry must stand alone. With splitting on, shared modules are hoisted into a
  // chunk imported by both the main and renderer entries, which breaks the guarantee
  // that a renderer bundle can never reach `electron`.
  splitting: false,
  treeshake: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
  external: ['electron', 'zod'],
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
});
