/**
 * Isomorphic entry: the plugin contract, the channel names and the error codec. Imports zod for
 * types only, so a plugin's `definitions.ts` can be compiled into the main and renderer bundles
 * alike without dragging `electron` or a runtime dependency into either.
 */

export {
  definePluginEvents,
  definePluginSchema,
  type MethodContract,
  type PluginEvents,
  type PluginSchema,
} from './contract/schema';

export type {
  PluginEmitter,
  PluginInterface,
  PluginListenerHandle,
  PluginMethod,
  PluginMethods,
  PluginShape,
} from './contract/interface';

export {
  definePlugin,
  type BaseHostContext,
  type ElectronPlugin,
  type PluginContext,
} from './contract/plugin';

export { DEFAULT_NAMESPACE, pluginChannels, type PluginChannels } from './shared/channels';

export {
  deserializePluginError,
  isSerializedPluginError,
  PluginError,
  serializePluginError,
  type PluginErrorCode,
  type PluginErrorInit,
  type ResultEnvelope,
  type SerializedPluginError,
} from './shared/errors';

export type { PluginHost } from './shared/host';
