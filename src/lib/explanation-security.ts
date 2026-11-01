import { Chess, validateFen } from "chess.js";

export const EXPLANATION_MODEL = "claude-haiku-5-5";
export const EXPLANATION_MAX_TOKENS = 300;
export type ExplanationInput = { fen: string; played: string; bestLine: string[]; rating: number };

export type ExplanationInvalidField = "body" | "fen" | "played" | "bestLine" | "rating";
export type ExplanationCheck = { ok: true; data: ExplanationInput } | { ok: false; field: ExplanationInvalidField };

export function checkExplanationInput(value: unknown): ExplanationCheck {
  if (!value || typeof value !== "object") return { ok: false, field: "body" };
  const { fen, played, bestLine, rating } = value as Record<string, unknown>;
  if (typeof fen !== "string" || fen.length > 120 || !validateFen(fen).ok) return { ok: false, field: "fen" };
  if (typeof played !== "string" || played.length < 1 || played.length > 12) return { ok: false, field: "played" };
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 0 || rating > 3500) return { ok: false, field: "rating" };
  if (!Array.isArray(bestLine) || bestLine.length < 1 || bestLine.length > 12) return { ok: false, field: "bestLine" };
  if (bestLine.some((move) => typeof move !== "string" || move.length < 1 || move.length > 12)) return { ok: false, field: "bestLine" };
  let canonicalPlayed: string;
  try { canonicalPlayed = new Chess(fen).move(played, { strict: true }).san; } catch { return { ok: false, field: "played" }; }
  try {
    const linePosition = new Chess(fen);
    const canonicalLine = bestLine.map((move: string) => linePosition.move(move, { strict: true }).san);
    return { ok: true, data: { fen: new Chess(fen).fen(), played: canonicalPlayed, bestLine: canonicalLine, rating } };
  } catch { return { ok: false, field: "bestLine" }; }
}

export function validateExplanationInput(value: unknown): ExplanationInput | null {
  const result = checkExplanationInput(value);
  return result.ok ? result.data : null;
}

export function allowedExplanationOrigin(origin: string | null, development = false): boolean {
  return origin === "https://chessyoda.com" ||
    origin === "https://id-preview--148f2dc3-6131-4c13-b3db-09bd09d28f7d.lovable.app" ||
    (development && origin === "http://localhost:8080");
}