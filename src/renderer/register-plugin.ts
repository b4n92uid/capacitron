import type { PluginListenerHandle } from '../contract/interface';
import { DEFAULT_NAMESPACE } from '../shared/channels';
import {
  deserializePluginError,
  isSerializedPluginError,
  PluginError,
  type ResultEnvelope,
} from '../shared/errors';
import type { PluginHost } from '../shared/host';

/**
 * Renderer-side client. Reads `globalThis` rather than `window` so this entry needs no DOM
 * types and stays usable in a worker or a plain Node test.
 */

let namespace = DEFAULT_NAMESPACE;

/**
 * Must run before the first plugin *call*, not before the first `registerPlugin()` — proxies
 * resolve the host lazily on every call, so module-eval-time registration is unaffected.
 */
export function setPluginNamespace(value: string): void {
  namespace = value;
}

export interface RegisterPluginOptions<T> {
  /** Capacitor's escape hatch: used only when no host is present. Resolved once, then cached. */
  web?: () => T | Promise<T> | { default: T } | Promise<{ default: T }>;
}

type WebFallback = Record<string, unknown>;

type AnyMethod = (...args: unknown[]) => Promise<unknown>;
type AnyAddListener = (
  event: string,
  listener: (payload: unknown) => void,
) => Promise<PluginListenerHandle>;

function resolveHost(): PluginHost | undefined {
  return (globalThis as Record<string, unknown>)[namespace] as PluginHost | undefined;
}

function unwrap(envelope: unknown, plugin: string, method: string): unknown {
  if (typeof envelope === 'object' && envelope !== null && 'ok' in envelope) {
    const result = envelope as ResultEnvelope;
    if (result.ok) return result.value;
    throw deserializePluginError(result.error);
  }
  if (isSerializedPluginError(envelope)) throw deserializePluginError(envelope);
  throw new PluginError(
    `Malformed reply for '${plugin}.${method}'. The preload and main-process halves of capacitron are probably different versions.`,
    { code: 'PROTOCOL_MISMATCH', plugin, method },
  );
}

/**
 * Builds a typed client for plugin `name`. Each call becomes one `invoke` over the single IPC
 * seam; typing comes from the caller's `<T>`, so there is no renderer-side registry.
 */
export function registerPlugin<T extends object>(
  name: string,
  options: RegisterPluginOptions<T> = {},
): T {
  let web: Promise<WebFallback> | undefined;

  const requireWeb = (method: string): Promise<WebFallback> => {
    const factory = options.web;
    if (!factory) {
      return Promise.reject(
        new PluginError(
          `Plugin host unavailable (globalThis.${namespace}): the Electron preload did not run and '${name}' declares no web fallback. Cannot call '${name}.${method}'.`,
          { code: 'HOST_UNAVAILABLE', plugin: name, method },
        ),
      );
    }
    web ??= Promise.resolve(factory()).then((resolved) => {
      const value = resolved as WebFallback;
      return (value['default'] as WebFallback | undefined) ?? value;
    });
    return web;
  };

  return new Proxy({} as T, {
    get(_target, property) {
      // Symbols and `then` must never look callable, or awaiting the proxy would hang.
      if (typeof property !== 'string' || property === 'then') return undefined;
      const method = property;

      if (method === 'addListener') {
        return async (
          event: string,
          listener: (payload: unknown) => void,
        ): Promise<PluginListenerHandle> => {
          const host = resolveHost();
          if (!host) {
            const fallback = await requireWeb(method);
            const implementation = fallback[method];
            if (typeof implementation !== 'function') {
              throw new PluginError(`Web fallback for '${name}' declares no addListener.`, {
                code: 'HOST_UNAVAILABLE',
                plugin: name,
                method,
              });
            }
            return (implementation as AnyAddListener)(event, listener);
          }
          const detach = host.addListener(name, event, listener);
          return {
            remove: () => {
              detach();
              return Promise.resolve();
            },
          };
        };
      }

      return async (...args: unknown[]): Promise<unknown> => {
        const host = resolveHost();
        if (!host) {
          const fallback = await requireWeb(method);
          const implementation = fallback[method];
          if (typeof implementation !== 'function') {
            throw new PluginError(`Web fallback for '${name}' has no method '${method}'.`, {
              code: 'UNKNOWN_METHOD',
              plugin: name,
              method,
            });
          }
          return (implementation as AnyMethod)(...args);
        }
        return unwrap(await host.invoke(name, method, args), name, method);
      };
    },
  });
}
