import type { PluginHost } from './shared/host';

/**
 * Opt-in only — `import 'capacitron/global'` from your own env.d.ts. It is not part of the
 * other entries because an unconditional ambient declaration leaks into every consuming program
 * and is wrong for anyone who changed the namespace.
 */
declare global {
  interface Window {
    capacitron?: PluginHost;
  }
}

export {};
