// Fixed-vocabulary diagnostics for the "Why?" explanation. Only these step and
// field names are ever logged: never user IDs, positions, tokens, keys or bodies.
export type ExplanationStep =
  | "auth check"
  | "origin check"
  | "input validation"
  | "configuration"
  | "daily limit"
  | "cache lookup"
  | "anthropic call"
  | "response parsing"
  | "cache write"
  | "unexpected error";

export type ExplanationField = "body" | "fen" | "played" | "bestLine" | "rating";

type Logger = (...args: unknown[]) => void;

function originalInfo(): Logger {
  const saved = (globalThis as { __chessYodaConsoleInfo?: Logger }).__chessYodaConsoleInfo;
  return saved ?? console.info.bind(console);
}

export function logExplanationStep(step: ExplanationStep, detail?: ExplanationField | number): void {
  originalInfo()(`[explain] failed step: ${step}${detail === undefined ? "" : ` (${detail})`}`);
}
