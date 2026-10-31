import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import type { MoveRecord } from "./types";
import type { Hint, MoveLabel, Threat } from "./coach";

export const TIME_CONTROLS = [
  { id: "10+0", label: "10+0", base: 600, inc: 0 },
  { id: "15+10", label: "15+10", base: 900, inc: 10 },
  { id: "30+0", label: "30+0", base: 1800, inc: 0 },
  { id: "none", label: "No clock", base: 0, inc: 0 },
] as const;
export type GameSettings = { color: Color; tc: (typeof TIME_CONTROLS)[number]; elo: number; coach: "off" | "safety" | "full"; allowTakebacks: boolean; showPossibleMoves: boolean };
export type GameSnapshot = {
  version: 1; settings: GameSettings; fen: string; pgn: string; records: MoveRecord[];
  clock: { w: number; b: number }; clockHistory: { w: number; b: number }[];
  takebacks: number; hintsUsed: number; pending: MoveRecord | null;
  lastLabel: { label: MoveLabel; san: string; rec: MoveRecord } | null;
  threat: { t: Threat; revealed: boolean; rec: MoveRecord } | null;
  hint: { h: Hint; level: number } | null; showEval: boolean;
  evalNow: { cp: number; mate: number | null };
};
export const MATERIAL_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const CAPTURE_ORDER = ["q", "r", "b", "n", "p"] as const;
export function materialAt(pgnOrMoves: string | string[], ply?: number) {
  const game = new Chess();
  if (typeof pgnOrMoves === "string") game.loadPgn(pgnOrMoves);
  else for (const san of pgnOrMoves) game.move(san);
  const moves = game.history({ verbose: true }).slice(0, ply);
  const captured: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  for (const move of moves) if (move.captured) captured[move.color].push(move.captured);
  // Count actual material, not captures alone: promotions affect the advantage.
  const initialFen = game.getHeaders()["FEN"];
  const position = initialFen ? new Chess(initialFen) : new Chess();
  for (const move of moves) position.move(move.san);
  const totals = { w: 0, b: 0 };
  for (const rank of position.board()) for (const piece of rank) if (piece) totals[piece.color] += MATERIAL_VALUES[piece.type];
  return { captured, advantage: { w: Math.max(0, totals.w - totals.b), b: Math.max(0, totals.b - totals.w) } };
}
export function isRatedUsage(takebacks: number, hintsUsed: number) { return takebacks === 0 && hintsUsed === 0; }
export function legalTargets(fen: string, square: Square) {
  return new Chess(fen).moves({ square, verbose: true }).map((move) => ({ square: move.to, capture: !!move.captured }));
}
export function restoreChess(snapshot: GameSnapshot): Chess {
  const chess = new Chess();
  chess.loadPgn(snapshot.pgn);
  if (chess.fen() !== snapshot.fen) throw new Error("Saved position is inconsistent");
  return chess;
}