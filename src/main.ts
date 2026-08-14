/** Main-process entry. Imports `electron`; never reference it from renderer code. */

export * from './index';
export { registerPluginBridge, type PluginBridge, type PluginBridgeOptions } from './main/bridge';
