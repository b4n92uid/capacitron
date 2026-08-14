import type { z } from 'zod';
import type { PluginEvents, PluginSchema } from './schema';

type ArgsOf<TArgs extends readonly z.ZodType[]> = {
  -readonly [TIndex in keyof TArgs]: z.infer<TArgs[TIndex]>;
};

/** The method half of a plugin's interface: one async call per schema entry. */
export type PluginMethods<TSchema extends PluginSchema> = {
  [TMethod in keyof TSchema]: (
    ...args: ArgsOf<TSchema[TMethod]['input']>
  ) => Promise<z.infer<TSchema[TMethod]['output']>>;
};

/** Detaches a listener, mirroring the handle Capacitor's `addListener` resolves to. */
export interface PluginListenerHandle {
  remove(): Promise<void>;
}

/**
 * `unknown` is the false branch rather than `{}` because intersecting with it is a no-op:
 * a plugin that declares no events gets no `addListener` on its interface at all.
 */
type PluginSubscriptions<TEvents extends PluginEvents> = [keyof TEvents] extends [never]
  ? unknown
  : {
      addListener<TEvent extends keyof TEvents & string>(
        event: TEvent,
        listener: (payload: z.infer<TEvents[TEvent]>) => void,
      ): Promise<PluginListenerHandle>;
    };

/** The TypeScript interface derived from a plugin's schema and events. */
export type PluginInterface<
  TSchema extends PluginSchema,
  TEvents extends PluginEvents = Record<never, never>,
> = PluginMethods<TSchema> & PluginSubscriptions<TEvents>;

/** Typed emitter a plugin's `create()` receives for its own declared events. */
export type PluginEmitter<TEvents extends PluginEvents> = <TEvent extends keyof TEvents & string>(
  event: TEvent,
  payload: z.infer<TEvents[TEvent]>,
) => void;

export type PluginMethod = (...args: never[]) => Promise<unknown>;

/** A plugin instance is a record of async methods reachable over the seam. */
export type PluginShape = Record<string, PluginMethod>;
