import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { coachingFacts, completeExplanation } from "@/lib/coaching-facts";
import { LEARNINGS_MAX_TOKENS, EXPLANATION_MAX_TOKENS } from "@/lib/explanation-security";
import type { MoveRecord } from "@/lib/types";
const c = new Chess(); const fenBefore = c.fen(); c.move("e4");
const record: MoveRecord = { ply: 1, fenBefore, fenAfter: c.fen(), san: "e4", uci: "e2e4", color: "w", evalBefore: 20, evalAfter: -100, mateAfter: null, bestUci: "d2d4", bestLine: ["d4", "d5", "c4", "e6", "Nc3"], replyLine: ["e5"], byPlayer: true };
describe("factual coaching", () => {
  it("uses exactly 300 tokens for Why and 500 for learnings", () => { expect(EXPLANATION_MAX_TOKENS).toBe(300); expect(LEARNINGS_MAX_TOKENS).toBe(500); });
  it("trims max_tokens output to the last complete sentence", () => expect(completeExplanation("First sentence. Second complete! unfinished wor", "max_tokens")).toBe("First sentence. Second complete!"));
  it("keeps complete answers and rejects truncated output without a complete sentence", () => { expect(completeExplanation("Complete answer.", "end_turn")).toBe("Complete answer."); expect(completeExplanation("unfinish", "max_tokens")).toBe(""); });
  it("supplies move descriptions, pawn evaluations and at most four SAN plies without FEN", () => {
    const facts = coachingFacts(record, 1400);
    expect(facts).toMatchObject({ rating: 1400, sideToMove: "White", moveNumber: 1, evaluationBefore: 0.2, evaluationAfter: -1, opponentReply: "e5" });
    expect(facts.moveDescription).toBe("pawn from e2 to e4; no capture"); expect(facts.mainLine).toHaveLength(4); expect(JSON.stringify(facts)).not.toContain(fenBefore);
  });
  it("normalizes evaluations to Black's perspective", () => { const b = new Chess(record.fenAfter); const before = b.fen(); b.move("e5"); expect(coachingFacts({ ...record, fenBefore: before, fenAfter: b.fen(), color: "b", san: "e5", bestLine: ["c5"], replyLine: ["Nf3"], evalBefore: 100, evalAfter: 200 }, 1400)).toMatchObject({ evaluationBefore: -1, evaluationAfter: -2 }); });
  it("does not equate a capture with a verified material win", () => { const b = new Chess(); for (const m of ["e4", "d5"]) b.move(m); const before = b.fen(); b.move("exd5"); const facts = coachingFacts({ ...record, fenBefore: before, fenAfter: b.fen(), san: "exd5", bestLine: ["exd5"], replyLine: ["Qxd5"] }, 1400); expect(facts.moveDescription).toContain("captures a pawn"); expect(facts.opponentGain).toContain("net material gain is not established"); });
});