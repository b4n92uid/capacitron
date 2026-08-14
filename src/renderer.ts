/** Renderer entry. Contains no `electron` import and no `window` reference. */

export * from './index';
export {
  registerPlugin,
  setPluginNamespace,
  type RegisterPluginOptions,
} from './renderer/register-plugin';
