import { Chess, validateFen } from "chess.js";
import type { MoveRecord } from "./types";
import { coachingFacts } from "./coaching-facts";

export const EXPLANATION_MODEL = "claude-haiku-5-5";
export const EXPLANATION_MAX_TOKENS = 300;
export const LEARNINGS_MAX_TOKENS = 500;
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

export function checkCoachingRecord(value: unknown): { ok: true; record: MoveRecord; rating: number } | { ok: false; field: ExplanationInvalidField } {
  if (!value || typeof value !== "object") return { ok: false, field: "body" };
  const { record, rating } = value as { record?: MoveRecord; rating?: number };
  if (!record || typeof record !== "object") return { ok: false, field: "body" };
  const checked = checkExplanationInput({ fen: record.fenBefore, played: record.san, bestLine: record.bestLine, rating });
  if (!checked.ok) return checked;
  if (typeof record.fenAfter !== "string" || record.fenAfter.length > 120 || !validateFen(record.fenAfter).ok) return { ok: false, field: "fen" };
  if (![record.evalBefore, record.evalAfter].every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 10000) || !["w", "b"].includes(record.color) || (record.mateAfter !== null && (!Number.isInteger(record.mateAfter) || Math.abs(record.mateAfter) > 200))) return { ok: false, field: "body" };
  if (!Array.isArray(record.replyLine) || record.replyLine.length > 4 || record.replyLine.some((m) => typeof m !== "string" || m.length > 12)) return { ok: false, field: "bestLine" };
  try {
    const canonical = { ...record, fenBefore: checked.data.fen, san: checked.data.played, bestLine: checked.data.bestLine };
    if (new Chess(canonical.fenBefore).turn() !== canonical.color) return { ok: false, field: "body" };
    coachingFacts(canonical, checked.data.rating);
    return { ok: true, record: canonical, rating: checked.data.rating };
  } catch { return { ok: false, field: "bestLine" }; }
}

export function whySystemPrompt(rating: number) {
  return `You are a calm chess coach. All moves you are given are legal and the engine analysis is correct: never question or recalculate them. Explain to a ${rating}-level player, in 2–3 short sentences: what the played move allowed, using the opponent's reply provided; why the engine's best move is better; and one short takeaway. Only mention moves that appear in the data. No hedging, no self-corrections, no preamble.`;
}