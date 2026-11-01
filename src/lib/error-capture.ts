// Never serialize arbitrary error arguments, causes, requests, or credentials.
export function describeError(_error: unknown): string {
  return "An application error occurred.";
}

type Logger = (...args: unknown[]) => void;
const store = globalThis as { __chessYodaConsoleInfo?: Logger; __chessYodaConsolePatched?: boolean };

// Patch once (module reloads must not wrap the wrapper) and keep one unfiltered
// channel for fixed-vocabulary diagnostics (see explain-diagnostics.ts).
if (!store.__chessYodaConsolePatched) {
  store.__chessYodaConsolePatched = true;
  store.__chessYodaConsoleInfo = console.info.bind(console);
  for (const level of ["error", "warn", "log", "info", "debug"] as const) {
    const original = console[level].bind(console);
    console[level] = (..._args: unknown[]) => {
      if (import.meta.env.DEV) for (const arg of _args) {
        if (arg instanceof Error) {
          const message = arg.message;
          const matched = message.match(/(?:[\w./@-]+ does not provide an export named [\w'" ]+|Cannot (?:read|access|find)[\w '"()./-]+|[^\n]*jstat[^\n]*|[^\n]*createServerFn[^\n]*)/);
          store.__chessYodaConsoleInfo?.("Safe error diagnostic", arg.name, matched?.[0] ?? "unmatched", arg.stack?.match(/(?:\/src\/|\/node_modules\/)[\w./?@-]+/g) ?? []);
        }
      }
      original("Application diagnostic event.");
    };
  }
}

export function consumeLastCapturedError(): undefined { return undefined; }
