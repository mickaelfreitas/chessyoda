import { Chess, validateFen } from "chess.js";

export const EXPLANATION_MODEL = "claude-haiku-5-5";
export const EXPLANATION_MAX_TOKENS = 200;
export type ExplanationInput = { fen: string; played: string; bestLine: string[]; rating: number };

export function validateExplanationInput(value: unknown): ExplanationInput | null {
  if (!value || typeof value !== "object") return null;
  const { fen, played, bestLine, rating } = value as Record<string, unknown>;
  if (typeof fen !== "string" || fen.length > 120 || !validateFen(fen).ok) return null;
  if (typeof played !== "string" || played.length < 1 || played.length > 12) return null;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 0 || rating > 3500) return null;
  if (!Array.isArray(bestLine) || bestLine.length < 1 || bestLine.length > 12) return null;
  if (bestLine.some((move) => typeof move !== "string" || move.length < 1 || move.length > 12)) return null;
  try {
    const playedPosition = new Chess(fen);
    const canonicalPlayed = playedPosition.move(played, { strict: true }).san;
    const linePosition = new Chess(fen);
    const canonicalLine = bestLine.map((move: string) => linePosition.move(move, { strict: true }).san);
    return { fen: new Chess(fen).fen(), played: canonicalPlayed, bestLine: canonicalLine, rating };
  } catch { return null; }
}

export function allowedExplanationOrigin(origin: string | null, development = false): boolean {
  return origin === "https://chessyoda.com" ||
    origin === "https://id-preview--148f2dc3-6131-4c13-b3db-09bd09d28f7d.lovable.app" ||
    (development && origin === "http://localhost:8080");
}