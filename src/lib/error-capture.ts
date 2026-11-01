// Never serialize arbitrary error arguments, causes, requests, or credentials.
export function describeError(_error: unknown): string {
  return "An application error occurred.";
}

// Keep one unfiltered channel for fixed-vocabulary diagnostics (see explain-diagnostics.ts).
(globalThis as { __chessYodaConsoleInfo?: (...args: unknown[]) => void }).__chessYodaConsoleInfo ??= console.info.bind(console);

for (const level of ["error", "warn", "log", "info", "debug"] as const) {
  const original = console[level].bind(console);
  console[level] = (..._args: unknown[]) => original("Application diagnostic event.");
}

export function consumeLastCapturedError(): undefined { return undefined; }
