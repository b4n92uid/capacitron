import type { PluginEmitter, PluginMethods, PluginShape } from './interface';
import type { PluginEvents, PluginSchema } from './schema';

/** Host services the bridge shares with every plugin unless the app supplies its own. */
export interface BaseHostContext {
  userDataPath: string;
}

/** What a plugin's `create()` receives: the host services, its emitter, its teardown hook. */
export type PluginContext<
  TEvents extends PluginEvents = PluginEvents,
  TContext extends object = BaseHostContext,
> = TContext & {
  emit: PluginEmitter<TEvents>;
  onDestroy(callback: () => void | Promise<void>): void;
};

/** Type-erased descriptor for the registry and the dispatcher. */
export interface ElectronPlugin<TContext extends object = BaseHostContext> {
  name: string;
  schema: PluginSchema;
  events?: PluginEvents;
  create(ctx: PluginContext<PluginEvents, TContext>): PluginShape;
}

/**
 * The generic signature checks `create()` against the schema-derived interface, then the cast
 * widens the result so a heterogeneous registry array type-checks. No runtime work.
 */
export function definePlugin<
  TSchema extends PluginSchema,
  TEvents extends PluginEvents = Record<never, never>,
  TContext extends object = BaseHostContext,
>(definition: {
  name: string;
  schema: TSchema;
  events?: TEvents;
  create(ctx: PluginContext<TEvents, TContext>): PluginMethods<TSchema>;
}): ElectronPlugin<TContext> {
  return definition as unknown as ElectronPlugin<TContext>;
}
