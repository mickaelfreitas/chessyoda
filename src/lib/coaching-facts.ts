import { Chess, type Move, type Color, type PieceSymbol } from "chess.js";
import type { MoveRecord } from "./types";

const names: Record<PieceSymbol, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const values: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const pieces: PieceSymbol[] = ["q", "r", "b", "n", "p"];
function inventory(chess: Chess, color: Color) {
  return pieces.map((piece) => chess.board().flat().filter((p) => p?.color === color && p.type === piece).length);
}
function material(chess: Chess, color: Color) {
  return inventory(chess, color).reduce((sum, count, i) => sum + count * values[pieces[i]], 0);
}
function listPieces(counts: number[]) {
  const words = ["no", "a", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return counts.flatMap((count, i) => count > 0 ? [`${words[count] ?? "several"} ${names[pieces[i]]}${count > 1 ? "s" : ""}`] : []).join(" and ");
}
export function evaluationSwingLabel(record: Pick<MoveRecord, "color" | "evalBefore" | "evalAfter" | "mateAfter">) {
  const sign = record.color === "w" ? 1 : -1;
  if (record.mateAfter !== null && record.mateAfter * sign < 0) return "allows checkmate";
  const loss = Math.max(0, (record.evalBefore - record.evalAfter) * sign) / 100;
  if (loss < 0.5) return "small inaccuracy";
  if (loss < 1.5) return "clear mistake";
  if (loss <= 3) return "costs about a piece's worth";
  return "losing";
}

// Replay the complete supplied alternative, including the player's initial capture.
// Inventory differences include promotions and use the starting board as the baseline.
export function lineMaterialFacts(fen: string, line: string[], player: Color) {
  const start = new Chess(fen);
  const end = new Chess(fen);
  const moves = line.map((san) => end.move(san, { strict: true }));
  const opponent = player === "w" ? "b" : "w";
  const lost = (color: Color) => inventory(start, color).map((count, i) => Math.max(0, count - inventory(end, color)[i]));
  const added = (color: Color) => inventory(end, color).map((count, i) => Math.max(0, count - inventory(start, color)[i]));
  const ownLost = listPieces(lost(player)); const opponentLost = listPieces(lost(opponent));
  const change = material(end, player) - material(end, opponent) - (material(start, player) - material(start, opponent));
  const captureValues = (color: Color) => moves.filter((m) => m.color === color && m.captured).reduce((sum, m) => sum + values[m.captured ?? "k"], 0);
  const labels = new Map<Move, "trade" | "wins material">();
  for (const color of [player, opponent]) {
    let tradeBudget = captureValues(color === "w" ? "b" : "w");
    // Account for equal-value exchanges first, then the unmatched larger captures.
    const captures = moves.filter((m) => m.color === color && m.captured).sort((a, b) => values[a.captured ?? "k"] - values[b.captured ?? "k"]);
    for (const move of captures) {
      const value = values[move.captured ?? "k"];
      labels.set(move, value > tradeBudget ? "wins material" : "trade");
      tradeBudget = Math.max(0, tradeBudget - value);
    }
  }
  let outcome: string;
  if (end.isCheckmate()) outcome = end.turn() === player ? "Played move allows checkmate" : "You deliver checkmate";
  else if (change === 0) {
    const equalAtEnd = material(end, player) === material(end, opponent);
    const traded = lost(player).flatMap((count, i) => count > 0 ? [names[pieces[i]]] : []);
    outcome = `${equalAtEnd ? "material stays equal" : "material balance stays unchanged"}${traded.length ? ` (${traded.join(" and ")} trade)` : " (no net material gain)"}`;
  } else if (ownLost && opponentLost) outcome = change < 0 ? `you lose ${ownLost} for ${opponentLost}` : `you win ${opponentLost} for ${ownLost}`;
  else if (ownLost) outcome = `you lose ${ownLost}`;
  else if (opponentLost) outcome = `you win ${opponentLost}`;
  else outcome = "material changes through promotion";
  const ownAdded = listPieces(added(player)); const opponentAdded = listPieces(added(opponent));
  if (ownAdded) outcome += `; your promotion adds ${ownAdded}`;
  if (opponentAdded) outcome += `; opponent promotion adds ${opponentAdded}`;
  return { outcome, moves: moves.map((m) => ({ san: m.san, side: m.color === "w" ? "White" : "Black", piece: names[m.piece], from: m.from, to: m.to, captured: m.captured ? names[m.captured] : null, captureOutcome: labels.get(m) ?? null, promotion: m.promotion ? names[m.promotion] : null, check: m.isCheck(), checkmate: m.isCheckmate() })) };
}

export function coachingFacts(record: MoveRecord, rating: number, replyLine = record.replyLine ?? []) {
  const position = new Chess(record.fenBefore);
  const played = position.move(record.san, { strict: true });
  if (position.fen() !== record.fenAfter) throw new Error("Inconsistent move position");
  const best = lineMaterialFacts(record.fenBefore, record.bestLine.slice(0, 4), record.color);
  const actual = lineMaterialFacts(record.fenBefore, [record.san, ...replyLine.slice(0, 4)], record.color);
  const allowsMate = evaluationSwingLabel(record) === "allows checkmate" || actual.moves.some((m) => m.checkmate && m.side !== (record.color === "w" ? "White" : "Black"));
  return {
    rating, sideToMove: played.color === "w" ? "White" : "Black", moveNumber: Number(record.fenBefore.split(" ")[5]),
    played: played.san,
    moveDescription: `${names[played.piece]} from ${played.from} to ${played.to}; ${played.captured ? `captures a ${names[played.captured]}` : "no capture"}${played.promotion ? `; promotes to ${names[played.promotion]}` : ""}${played.isKingsideCastle() || played.isQueensideCastle() ? "; castles" : ""}`,
    swingLabel: allowsMate ? "allows checkmate" : evaluationSwingLabel(record),
    bestMove: best.moves[0]?.san ?? null, mainLine: best.moves.map((m) => m.san), mainLineFacts: best.moves,
    bestLineMaterialOutcome: `Net result of best line: ${best.outcome}`,
    playedLineMaterialOutcome: allowsMate ? "Played move allows checkmate" : `Net result of played line: ${actual.outcome}`,
    playedLineFacts: actual.moves,
    opponentReply: actual.moves[1]?.san ?? null, opponentLine: actual.moves.slice(1).map((m) => m.san), opponentLineFacts: actual.moves.slice(1),
    lineScope: "Material outcomes compare the end of each supplied alternative with the same starting board; no claim about moves beyond these continuations.",
    mistakeType: record.mistakeType ?? null,
  };
}

export function completeExplanation(text: string, stopReason?: string | null, maxSentences?: number): string {
  let clean = text.trim();
  const endings = [...clean.matchAll(/[.!?](?:["”’']*)(?=\s|$)/g)];
  if (maxSentences !== undefined && endings.length >= maxSentences) {
    const last = endings[maxSentences - 1];
    if (last?.index !== undefined) return clean.slice(0, last.index + last[0].length).trim();
  }
  if (stopReason === "max_tokens") {
    const last = endings.at(-1);
    clean = last?.index === undefined ? "" : clean.slice(0, last.index + last[0].length).trim();
  }
  return clean;
}
