import { Chess, type PieceSymbol } from "chess.js";
import type { MoveRecord } from "./types";

const names: Record<PieceSymbol, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export function coachingFacts(record: MoveRecord, rating: number, replyLine = record.replyLine ?? []) {
  const position = new Chess(record.fenBefore);
  const number = Number(record.fenBefore.split(" ")[5]);
  const played = position.move(record.san, { strict: true });
  if (position.fen() !== record.fenAfter) throw new Error("Inconsistent move position");
  const best = new Chess(record.fenBefore);
  const bestMoves = record.bestLine.slice(0, 4).map((san) => best.move(san, { strict: true }));
  const mainLine = bestMoves.map((m) => m.san);
  const replies = new Chess(record.fenAfter);
  const verifiedReplies = replyLine.slice(0, 4).map((san) => replies.move(san, { strict: true }));
  const reply = verifiedReplies[0];
  const sign = record.color === "w" ? 1 : -1;
  return {
    rating, sideToMove: played.color === "w" ? "White" : "Black", moveNumber: number,
    played: played.san,
    moveDescription: `${names[played.piece]} from ${played.from} to ${played.to}; ${played.captured ? `captures a ${names[played.captured]}` : "no capture"}${played.promotion ? `; promotes to ${names[played.promotion]}` : ""}${played.isKingsideCastle() || played.isQueensideCastle() ? "; castles" : ""}`,
    evaluationBefore: record.evalBefore * sign / 100, evaluationAfter: record.evalAfter * sign / 100,
    bestMove: mainLine[0] ?? null, mainLine,
    mainLineFacts: bestMoves.map((m) => ({ san: m.san, side: m.color === "w" ? "White" : "Black", piece: names[m.piece], from: m.from, to: m.to, captured: m.captured ? names[m.captured] : null, check: m.san.includes("+"), checkmate: m.san.includes("#") })),
    opponentReply: reply?.san ?? null, opponentLine: verifiedReplies.map((m) => m.san),
    opponentLineFacts: verifiedReplies.map((m) => ({ san: m.san, side: m.color === "w" ? "White" : "Black", captured: m.captured ? names[m.captured] : null, checkmate: m.san.includes("#") })),
    opponentGain: reply?.san.includes("#") ? "checkmate" : record.mateAfter !== null && record.mateAfter * sign < 0 ? `forced mate in ${Math.abs(record.mateAfter)}` : reply?.captured ? `captures a ${names[reply.captured]}; net material gain is not established by a capture alone` : record.evalAfter * sign <= -200 ? "winning position according to engine evaluation" : "positional improvement; no verified material win or forced mate",
    mistakeType: record.mistakeType ?? null,
  };
}

export function completeExplanation(text: string, stopReason?: string | null): string {
  const clean = text.trim();
  if (stopReason !== "max_tokens") return clean;
  const sentences = [...clean.matchAll(/[.!?](?:["”’']*)\s*(?=\s|$)/g)];
  const last = sentences.at(-1);
  return last?.index === undefined ? "" : clean.slice(0, last.index + last[0].trimEnd().length).trim();
}