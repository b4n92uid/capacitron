import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { z } from 'zod';
import type { PluginShape } from '../contract/interface';
import type { BaseHostContext, ElectronPlugin, PluginContext } from '../contract/plugin';
import type { PluginEvents, PluginSchema } from '../contract/schema';
import { DEFAULT_NAMESPACE, pluginChannels, type PluginChannels } from '../shared/channels';
import { PluginError, serializePluginError, type ResultEnvelope } from '../shared/errors';
import { installAutoDispose } from './lifecycle';

const envelopeSchema = z.object({
  plugin: z.string(),
  method: z.string(),
  args: z.array(z.unknown()),
});

export interface PluginBridgeOptions<TContext extends object> {
  /** Host services shared with every plugin. Defaults to `{ userDataPath }`. */
  context?: TContext;
  namespace?: string;
  /** Tear down on `before-quit`, awaited. Off for apps with their own shutdown order. */
  autoDispose?: boolean;
  validateOutput?: boolean;
  /** Returning false rejects the call with code `FORBIDDEN`. Default allows everything. */
  canInvoke?(sender: WebContents, plugin: string, method: string): boolean;
}

export interface PluginBridge {
  dispose(): Promise<void>;
  readonly channels: PluginChannels;
  /** Resolves once every plugin's `init` has run. Never rejects. */
  readonly ready: Promise<void>;
}

interface Teardown {
  name: string;
  callbacks: Array<() => void | Promise<void>>;
}

/**
 * Instantiates every plugin and wires one IPC dispatcher for all of them. Plugins never register
 * a channel of their own: calls are routed on one channel, events broadcast on a second.
 */
export function registerPluginBridge<TContext extends object = BaseHostContext>(
  plugins: ReadonlyArray<ElectronPlugin<TContext>>,
  options: PluginBridgeOptions<TContext> = {},
): PluginBridge {
  const channels = pluginChannels(options.namespace ?? DEFAULT_NAMESPACE);
  const validateOutput = options.validateOutput ?? true;

  // Reject duplicates before instantiating anything, so a bad registry cannot leave live
  // plugin instances behind with no dispatcher and no way to dispose them.
  const seen = new Set<string>();
  for (const plugin of plugins) {
    if (seen.has(plugin.name)) {
      throw new Error(`capacitron: duplicate plugin name '${plugin.name}'.`);
    }
    seen.add(plugin.name);
  }

  const instances = new Map<string, PluginShape>();
  const schemas = new Map<string, PluginSchema>();
  const contexts = new Map<string, PluginContext<PluginEvents, TContext>>();
  const teardowns: Teardown[] = [];

  for (const plugin of plugins) {
    const callbacks: Array<() => void | Promise<void>> = [];
    const ctx = {
      ...(options.context ?? {}),
      // Bound to this plugin's own name, so no plugin can emit as another.
      emit: (event: string, payload: unknown) =>
        broadcast(channels.event, plugin.name, event, payload),
      onDestroy: (callback: () => void | Promise<void>) => {
        callbacks.push(callback);
      },
    } as PluginContext<PluginEvents, TContext>;

    if (options.context === undefined) {
      // Read on access, since an earlier plugin's create() may call app.setPath('userData').
      Object.defineProperty(ctx, 'userDataPath', {
        get: () => app.getPath('userData'),
        enumerable: true,
      });
    }

    contexts.set(plugin.name, ctx);
    instances.set(plugin.name, plugin.create(ctx));
    schemas.set(plugin.name, plugin.schema);
    teardowns.push({ name: plugin.name, callbacks });
  }

  let initStarted = false;
  const ready: Promise<void> = app.whenReady().then(async () => {
    initStarted = true;
    for (const plugin of plugins) {
      if (!plugin.init) continue;
      try {
        await plugin.init(contexts.get(plugin.name)!);
      } catch (error) {
        console.error(`capacitron: plugin '${plugin.name}' failed to init`, error);
      }
    }
  });

  ipcMain.handle(
    channels.invoke,
    async (event: IpcMainInvokeEvent, payload: unknown): Promise<ResultEnvelope> => {
      let plugin = '';
      let method = '';
      try {
        await ready;
        const parsed = envelopeSchema.parse(payload);
        plugin = parsed.plugin;
        method = parsed.method;

        if (options.canInvoke && !options.canInvoke(event.sender, plugin, method)) {
          throw new PluginError(`Call to '${plugin}.${method}' was refused.`, {
            code: 'FORBIDDEN',
          });
        }

        const instance = instances.get(plugin);
        if (!instance) {
          throw new PluginError(`Unknown plugin '${plugin}'.`, { code: 'UNKNOWN_PLUGIN' });
        }

        const handler = instance[method];
        if (typeof handler !== 'function') {
          throw new PluginError(`Unknown plugin method '${plugin}.${method}'.`, {
            code: 'UNKNOWN_METHOD',
          });
        }

        const contract = schemas.get(plugin)?.[method];
        const args = (
          contract
            ? contract.input.map((schema, index) => schema.parse(parsed.args[index]))
            : parsed.args
        ) as never[];

        const value: unknown = await handler(...args);
        if (!validateOutput || !contract) return { ok: true, value };

        const result = contract.output.safeParse(value);
        if (!result.success) {
          throw new PluginError(`Output of '${plugin}.${method}' does not match its schema.`, {
            code: 'OUTPUT_INVALID',
            issues: result.error.issues,
          });
        }
        return { ok: true, value: result.data };
      } catch (error) {
        // The handler must never reject: Electron would collapse the error into its message.
        return { ok: false, error: serializePluginError(error, { plugin, method }) };
      }
    },
  );

  let disposed = false;
  let removeAutoDispose: (() => void) | undefined;

  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    removeAutoDispose?.();
    ipcMain.removeHandler(channels.invoke);
    if (initStarted) await ready;

    // Reverse registration order, LIFO within a plugin: a later plugin may depend on an
    // earlier one still being alive.
    const failures: unknown[] = [];
    for (const entry of [...teardowns].reverse()) {
      for (const callback of [...entry.callbacks].reverse()) {
        try {
          await callback();
        } catch (error) {
          failures.push(error);
        }
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, 'capacitron: one or more plugins failed to tear down.');
    }
  };

  if (options.autoDispose !== false) {
    removeAutoDispose = installAutoDispose(dispose);
  }

  return { dispose, channels, ready };
}

/**
 * Broadcasts to every live window; an event emitted before the first window opens is dropped.
 * A plugin whose event can precede it must also expose a pull method.
 */
function broadcast(channel: string, plugin: string, event: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, { plugin, event, payload });
  }
}
