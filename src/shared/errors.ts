/**
 * Errors cross IPC as data, not as thrown values: Electron's `ipcMain.handle` rehydrates a
 * rejection as `Error invoking remote method '...'` and keeps nothing but the message, so the
 * dispatcher answers with an envelope and the renderer rebuilds the error from these fields.
 *
 * No zod import here — a `ZodError` is recognised structurally, which keeps this module usable
 * from the renderer and the preload.
 */

export type PluginErrorCode =
  | 'INVALID_ARGUMENT'
  | 'OUTPUT_INVALID'
  | 'UNKNOWN_PLUGIN'
  | 'UNKNOWN_METHOD'
  | 'FORBIDDEN'
  | 'HOST_UNAVAILABLE'
  | 'PROTOCOL_MISMATCH'
  | 'PLUGIN_ERROR'
  | (string & {});

export interface SerializedPluginError {
  __pluginError: true;
  /** Preserved so `err.name === 'ZodError'` still reads true on the renderer side. */
  name: string;
  message: string;
  code: string;
  stack?: string;
  plugin?: string;
  method?: string;
  issues?: unknown[];
  data?: unknown;
  cause?: SerializedPluginError;
}

/** What every `invoke` resolves to. The dispatcher never rejects. */
export type ResultEnvelope =
  { ok: true; value: unknown } | { ok: false; error: SerializedPluginError };

export interface PluginErrorInit {
  code?: PluginErrorCode;
  plugin?: string;
  method?: string;
  data?: unknown;
  issues?: unknown[];
  cause?: unknown;
}

/**
 * Each package entry carries its own copy of this class (entries are built standalone so a
 * renderer bundle can never reach `electron`), so a class-identity `instanceof` would fail for
 * an error thrown by `./main` and caught against `./renderer`. A registry-symbol brand plus
 * `Symbol.hasInstance` makes `instanceof` answer on the brand instead, which also survives two
 * copies of the package in one tree.
 */
const BRAND = Symbol.for('capacitron.PluginError');

export class PluginError extends Error {
  static override [Symbol.hasInstance](value: unknown): boolean {
    return typeof value === 'object' && value !== null && BRAND in value;
  }

  readonly code: string;
  readonly plugin: string | undefined;
  readonly method: string | undefined;
  readonly data: unknown;
  readonly issues: unknown[] | undefined;

  constructor(message: string, init: PluginErrorInit = {}) {
    super(message, init.cause === undefined ? undefined : { cause: init.cause });
    Object.defineProperty(this, BRAND, { value: true });
    this.name = 'PluginError';
    this.code = init.code ?? 'PLUGIN_ERROR';
    this.plugin = init.plugin;
    this.method = init.method;
    this.data = init.data;
    this.issues = init.issues;
  }
}

interface ErrorLike {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  issues?: unknown;
  cause?: unknown;
  code?: unknown;
  data?: unknown;
}

function isZodError(value: ErrorLike): boolean {
  return value.name === 'ZodError' && Array.isArray(value.issues);
}

/** Drops anything structured-clone would choke on rather than failing the whole call. */
function toCloneable(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return '[unserializable]';
  }
}

function describe(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value) ?? '[object]';
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

export function serializePluginError(
  error: unknown,
  at: { plugin?: string; method?: string } = {},
  depth = 0,
): SerializedPluginError {
  if (typeof error !== 'object' || error === null) {
    return {
      __pluginError: true,
      name: 'Error',
      message: describe(error),
      code: 'PLUGIN_ERROR',
      ...at,
    };
  }

  const source = error as ErrorLike;
  const wire: SerializedPluginError = {
    __pluginError: true,
    name: typeof source.name === 'string' ? source.name : 'Error',
    message: typeof source.message === 'string' ? source.message : describe(error),
    code: 'PLUGIN_ERROR',
    ...at,
  };

  if (typeof source.stack === 'string') wire.stack = source.stack;

  if (error instanceof PluginError) {
    wire.code = error.code;
    if (error.plugin) wire.plugin = error.plugin;
    if (error.method) wire.method = error.method;
    if (error.issues) wire.issues = toCloneable(error.issues) as unknown[];
    if (error.data !== undefined) wire.data = toCloneable(error.data);
  } else if (isZodError(source)) {
    wire.code = 'INVALID_ARGUMENT';
    wire.issues = toCloneable(source.issues) as unknown[];
  } else if (typeof source.code === 'string') {
    // Node system errors (ENOENT, ECONNREFUSED) already carry a usable code.
    wire.code = source.code;
  }

  // One level only: a deeper chain is rarely read and cycles are cheap to avoid this way.
  if (depth === 0 && source.cause !== undefined && source.cause !== null) {
    wire.cause = serializePluginError(source.cause, {}, 1);
  }

  return wire;
}

export function isSerializedPluginError(value: unknown): value is SerializedPluginError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as SerializedPluginError).__pluginError === true
  );
}

/**
 * Always returns a `PluginError`, never a reconstructed `ZodError`: rebuilding a zod instance
 * would tie the renderer to zod's constructor shape. `err.code` is the supported discriminant,
 * and `issues` / `data` carry across intact.
 */
export function deserializePluginError(wire: SerializedPluginError): PluginError {
  const error = new PluginError(wire.message, {
    code: wire.code,
    plugin: wire.plugin,
    method: wire.method,
    data: wire.data,
    issues: wire.issues,
    cause: wire.cause ? deserializePluginError(wire.cause) : undefined,
  });
  error.name = wire.name;
  if (wire.stack) {
    error.stack = `${wire.stack}\n    --- via capacitron IPC ---\n${error.stack ?? ''}`;
  }
  return error;
}
