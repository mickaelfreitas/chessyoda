// Never serialize arbitrary error arguments, causes, requests, or credentials.
export function describeError(_error: unknown): string {
  return "An application error occurred.";
}

for (const level of ["error", "warn", "log", "info", "debug"] as const) {
  const original = console[level].bind(console);
  console[level] = (..._args: unknown[]) => original("Application diagnostic event.");
}

export function consumeLastCapturedError(): undefined { return undefined; }
