import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { DEFAULT_NAMESPACE, pluginChannels } from '../shared/channels';
import type { PluginHost } from '../shared/host';

export interface PluginHostOptions {
  /** Names both IPC channels and the `contextBridge` key. Must match the bridge's. */
  namespace?: string;
  /** Cap on replayable events per `plugin:event` key. Oldest are dropped. */
  maxPendingPerEvent?: number;
}

interface EventMessage {
  plugin: string;
  event: string;
  payload: unknown;
}

export interface DisposablePluginHost extends PluginHost {
  dispose: () => void;
}

/**
 * The preload attaches long before the renderer framework boots, so an event pushed in that gap
 * would land with nothing subscribed. It is queued per `plugin:event` key and replayed to the
 * first subscriber instead — the cold-start callback case (a login redirect, a launch URL).
 */
export function createPluginHost(options: PluginHostOptions = {}): DisposablePluginHost {
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const maxPending = options.maxPendingPerEvent ?? 50;
  const channels = pluginChannels(namespace);

  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const pending = new Map<string, unknown[]>();

  const key = (plugin: string, event: string): string => `${plugin}:${event}`;

  const onEvent = (_event: IpcRendererEvent, message: EventMessage): void => {
    const id = key(message.plugin, message.event);
    const subscribed = listeners.get(id);
    if (subscribed?.size) {
      for (const listener of subscribed) listener(message.payload);
      return;
    }
    const queue = pending.get(id) ?? [];
    queue.push(message.payload);
    if (queue.length > maxPending) queue.splice(0, queue.length - maxPending);
    pending.set(id, queue);
  };

  ipcRenderer.on(channels.event, onEvent);

  return {
    invoke: (plugin, method, args) =>
      ipcRenderer.invoke(channels.invoke, { plugin, method, args }) as Promise<unknown>,

    addListener: (plugin, event, listener) => {
      const id = key(plugin, event);
      const subscribed = listeners.get(id) ?? new Set<(payload: unknown) => void>();
      subscribed.add(listener);
      listeners.set(id, subscribed);

      const queued = pending.get(id);
      pending.delete(id);
      for (const payload of queued ?? []) listener(payload);

      return () => {
        subscribed.delete(listener);
        if (!subscribed.size) listeners.delete(id);
      };
    },

    dispose: () => {
      ipcRenderer.removeListener(channels.event, onEvent);
      listeners.clear();
      pending.clear();
    },
  };
}

/** The whole preload for most apps. `dispose` is deliberately not exposed to the renderer. */
export function exposePluginHost(options: PluginHostOptions = {}): void {
  const host = createPluginHost(options);
  contextBridge.exposeInMainWorld(options.namespace ?? DEFAULT_NAMESPACE, {
    invoke: host.invoke,
    addListener: host.addListener,
  });
}
