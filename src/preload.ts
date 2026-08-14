/** Preload entry. Deliberately does not re-export the contract: it stays zod-free. */

export {
  createPluginHost,
  exposePluginHost,
  type DisposablePluginHost,
  type PluginHostOptions,
} from './preload/host';
export { DEFAULT_NAMESPACE, pluginChannels, type PluginChannels } from './shared/channels';
export type { PluginHost } from './shared/host';
