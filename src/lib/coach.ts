// Rule-based coaching from engine data — no AI calls, runs instantly.
import { Chess, type Square, type Color, type PieceSymbol } from "chess.js";

export type MoveLabel = "best" | "good" | "inaccuracy" | "mistake" | "blunder";
export type MistakeType = "hanging_piece" | "missed_tactic" | "endgame_error";

export const LABEL_TEXT: Record<MoveLabel, string> = {
  best: "Best",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

export const MISTAKE_TYPE_TEXT: Record<MistakeType, string> = {
  hanging_piece: "Hanging pieces",
  missed_tactic: "Missed tactics",
  endgame_error: "Endgame errors",
};

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const PIECE_NAME: Record<PieceSymbol, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** Clamp an eval (centipawns, White POV) so mates don't distort loss math. */
export const capEval = (cp: number) => Math.max(-1000, Math.min(1000, cp));

/** Eval drop for the side that moved, in centipawns (positive = worse). */
export function evalLoss(evalBefore: number, evalAfter: number, mover: Color) {
  const b = capEval(evalBefore);
  const a = capEval(evalAfter);
  return mover === "w" ? b - a : a - b;
}

export const SAFETY_NET_THRESHOLD = 200;

export function classifyMove(loss: number, playedBest: boolean): MoveLabel {
  if (playedBest || loss <= 10) return "best";
  if (loss <= 50) return "good";
  if (loss <= 100) return "inaccuracy";
  if (loss <= 200) return "mistake";
  return "blunder";
}

export function isEndgame(fen: string) {
  const board = fen.split(" ")[0] ?? "";
  const pieces = board.replace(/[^nbrqNBRQ]/g, "").length;
  return pieces <= 4;
}

/** Pieces of `color` that are attacked and either undefended or attacked by a cheaper piece. */
export function hangingPieces(fen: string, color: Color): Square[] {
  const chess = new Chess(fen);
  const enemy: Color = color === "w" ? "b" : "w";
  const out: Square[] = [];
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color || sq.type === "k") continue;
      const attackers = chess.attackers(sq.square, enemy);
      if (!attackers.length) continue;
      const defenders = chess.attackers(sq.square, color);
      const cheapest = Math.min(...attackers.map((a) => PIECE_VALUE[chess.get(a)!.type]));
      if (!defenders.length || cheapest < PIECE_VALUE[sq.type]) out.push(sq.square);
    }
  }
  return out;
}

/** FEN with the side to move flipped — used to ask "what would they do if it were their move?". */
export function nullMoveFen(fen: string): string | null {
  const chess = new Chess(fen);
  if (chess.inCheck()) return null;
  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  try {
    new Chess(parts.join(" "));
    return parts.join(" ");
  } catch {
    return null;
  }
}

export function uciToSan(fen: string, uci: string): string | null {
  try {
    const c = new Chess(fen);
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
    return m?.san ?? null;
  } catch {
    return null;
  }
}

export function pvToSan(fen: string, pv: string[], max = 6): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, max)) {
    try {
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out;
}

export type Threat = { text: string; squares: Square[]; arrow?: { from: string; to: string } };

/**
 * Describe what the opponent threatens in `fen` (player to move).
 * `threatMove` is the opponent's best move from a null-move search (may be null).
 */
export function describeThreat(fen: string, player: Color, threatMove: string | null, threatGain: number): Threat {
  const chess = new Chess(fen);
  if (chess.inCheck()) {
    const king = chess.board().flat().find((s) => s && s.type === "k" && s.color === player)!;
    return { text: "You're in check — deal with it first.", squares: [king.square] };
  }
  const hanging = hangingPieces(fen, player);
  if (threatMove && threatGain >= 150) {
    const from = threatMove.slice(0, 2) as Square;
    const to = threatMove.slice(2, 4) as Square;
    const nf = nullMoveFen(fen)!;
    const nc = new Chess(nf);
    const target = nc.get(to);
    const san = uciToSan(nf, threatMove) ?? threatMove;
    const text = target
      ? `They threaten ${san}, winning your ${PIECE_NAME[target.type]}.`
      : san.includes("#")
        ? `They threaten checkmate with ${san}!`
        : `They threaten ${san} — a strong attacking move.`;
    return { text, squares: [...new Set([to, ...hanging])], arrow: { from, to } };
  }
  if (hanging.length) {
    const p = chess.get(hanging[0]!)!;
    return { text: `Your ${PIECE_NAME[p.type]} on ${hanging[0]!} is under attack.`, squares: hanging };
  }
  return { text: "No immediate threat — you have time to improve your position.", squares: [] };
}

export type Hint = { nudge: string; keySquare: Square; from: Square; to: Square };

/** Build a 3-level hint from the coach's analysis (multipv ≥ 1) of the player's position. */
export function buildHint(fen: string, player: Color, best: string, lines: { cp: number }[]): Hint | null {
  if (!best) return null;
  const from = best.slice(0, 2) as Square;
  const to = best.slice(2, 4) as Square;
  const chess = new Chess(fen);
  const target = chess.get(to);
  let move;
  try {
    move = chess.move({ from, to, promotion: best[4] ?? "q" });
  } catch {
    return null;
  }
  const sign = player === "w" ? 1 : -1;
  const gap = lines.length > 1 ? (capEval(lines[0]!.cp) - capEval(lines[1]!.cp)) * sign : 0;
  const myHanging = hangingPieces(fen, player);
  const enemyHanging = hangingPieces(fen, player === "w" ? "b" : "w");
  let nudge = "Improve your least active piece.";
  if (move.san.includes("#")) nudge = "There's a checkmate available!";
  else if (target && enemyHanging.includes(to)) nudge = "An enemy piece is undefended.";
  else if (gap >= 150) nudge = "There's a tactic available — look for forcing moves.";
  else if (myHanging.includes(from)) nudge = "One of your pieces is in danger.";
  else if (move.san.includes("+")) nudge = "Consider a check.";
  else if (target) nudge = "Look for a good capture.";
  return { nudge, keySquare: from, from, to };
}

/** Categorize a mistake for progress stats. `replyMove` = engine's best reply after the played move. */
export function categorizeMistake(fenBefore: string, fenAfter: string, replyMove: string | null): MistakeType {
  if (isEndgame(fenBefore)) return "endgame_error";
  if (replyMove) {
    const c = new Chess(fenAfter);
    const target = c.get(replyMove.slice(2, 4) as Square);
    if (target && target.type !== "p") return "hanging_piece";
  }
  return "missed_tactic";
}

export function formatEval(cp: number, mate: number | null) {
  if (mate !== null) return `${mate > 0 ? "" : "-"}M${Math.abs(mate)}`;
  const v = cp / 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}
