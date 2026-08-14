/** The seam the preload exposes and the renderer proxies call through. Zero imports. */
export interface PluginHost {
  invoke: (plugin: string, method: string, args: unknown[]) => Promise<unknown>;
  /** Subscribes to one plugin event; the returned function detaches the listener. */
  addListener: (plugin: string, event: string, listener: (payload: unknown) => void) => () => void;
}
