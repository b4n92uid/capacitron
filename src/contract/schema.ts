import type { z } from 'zod';

/** Argument schemas (positional) plus the output schema for a single method. */
export interface MethodContract {
  input: readonly z.ZodType[];
  output: z.ZodType;
}

/** A plugin's full contract: method name to its `MethodContract`. */
export type PluginSchema = Record<string, MethodContract>;

/** A plugin's events: event name to its payload schema. */
export type PluginEvents = Record<string, z.ZodType>;

/**
 * The `const` type parameter keeps the literal shape, so argument arrays stay tuples and
 * `PluginInterface` can derive exact method signatures. Identity at runtime.
 */
export function definePluginSchema<const TSchema extends PluginSchema>(schema: TSchema): TSchema {
  return schema;
}

export function definePluginEvents<const TEvents extends PluginEvents>(events: TEvents): TEvents {
  return events;
}
