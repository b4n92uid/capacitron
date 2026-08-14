/**
 * Zero imports on purpose: the preload must reach the channel names without pulling zod
 * into a bundle that may run sandboxed.
 */

export const DEFAULT_NAMESPACE = 'capacitron';

export interface PluginChannels {
  invoke: string;
  event: string;
}

/** The namespace also names the `contextBridge` key, so all three sides derive from it. */
export function pluginChannels(namespace: string = DEFAULT_NAMESPACE): PluginChannels {
  return { invoke: `${namespace}:invoke`, event: `${namespace}:event` };
}
