import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { coachingFacts, completeExplanation, evaluationSwingLabel, lineMaterialFacts } from "@/lib/coaching-facts";
import { LEARNINGS_MAX_TOKENS, EXPLANATION_MAX_TOKENS } from "@/lib/explanation-security";
import type { MoveRecord } from "@/lib/types";
const c = new Chess(); const fenBefore = c.fen(); c.move("e4");
const record: MoveRecord = { ply: 1, fenBefore, fenAfter: c.fen(), san: "e4", uci: "e2e4", color: "w", evalBefore: 20, evalAfter: -100, mateAfter: null, bestUci: "d2d4", bestLine: ["d4", "d5", "c4", "e6", "Nc3"], replyLine: ["e5"], byPlayer: true };
describe("factual coaching", () => {
  it("uses exactly 300 tokens for Why and 500 for learnings", () => { expect(EXPLANATION_MAX_TOKENS).toBe(300); expect(LEARNINGS_MAX_TOKENS).toBe(500); });
  it("trims max_tokens output to the last complete sentence", () => expect(completeExplanation("First sentence. Second complete! unfinished wor", "max_tokens")).toBe("First sentence. Second complete!"));
  it("keeps only the first three sentences", () => expect(completeExplanation("Allowed this. Better that! Learn this? Ignore this.", "end_turn", 3)).toBe("Allowed this. Better that! Learn this?"));
  it("also drops an unfinished fourth sentence without max_tokens", () => expect(completeExplanation("Allowed this. Better that. Learn this. unfinished", "end_turn", 3)).toBe("Allowed this. Better that. Learn this."));
  it("does not split on decimal points in an older cached answer", () => expect(completeExplanation("Cost 1.58 pawns. Better move. Takeaway. Fourth.", null, 3)).toBe("Cost 1.58 pawns. Better move. Takeaway."));
  it("keeps complete answers and rejects truncated output without a complete sentence", () => { expect(completeExplanation("Complete answer.", "end_turn")).toBe("Complete answer."); expect(completeExplanation("unfinish", "max_tokens")).toBe(""); });
  it("does not cap key-learnings output", () => expect(completeExplanation("One. Two. Three. Four. Five.", "end_turn")).toBe("One. Two. Three. Four. Five."));
  it("supplies verbal swing and four SAN plies without numeric evaluations or FEN", () => {
    const facts = coachingFacts(record, 1400);
    expect(facts).toMatchObject({ rating: 1400, sideToMove: "White", moveNumber: 1, swingLabel: "clear mistake", opponentReply: "e5" });
    expect(facts.moveDescription).toBe("pawn from e2 to e4; no capture"); expect(facts.mainLine).toHaveLength(4); expect(JSON.stringify(facts)).not.toContain(fenBefore);
    expect(facts).not.toHaveProperty("evaluationBefore"); expect(facts).not.toHaveProperty("evaluationAfter"); expect(facts).not.toHaveProperty("replyLineMaterialBalance");
  });
  it.each([[49, "small inaccuracy"], [50, "clear mistake"], [149, "clear mistake"], [150, "costs about a piece's worth"], [300, "costs about a piece's worth"], [301, "losing"]])("maps a %i cp swing to %s", (loss, label) => {
    expect(evaluationSwingLabel({ ...record, evalBefore: 0, evalAfter: -Number(loss) })).toBe(label);
  });
  it("normalizes Black's swing", () => expect(evaluationSwingLabel({ ...record, color: "b", evalBefore: -168, evalAfter: -47 })).toBe("clear mistake"));
  it("uses allows checkmate for an opponent forced mate", () => { expect(evaluationSwingLabel({ ...record, mateAfter: -1 })).toBe("allows checkmate"); expect(evaluationSwingLabel({ ...record, color: "b", mateAfter: 2 })).toBe("allows checkmate"); });
  it("does not call the player's own forced mate an allowed mate", () => expect(evaluationSwingLabel({ ...record, mateAfter: 1 })).toBe("clear mistake"));
  it("includes the played capture in the baseline, labeling a pawn recapture as a trade", () => {
    const b = new Chess(); for (const m of ["e4", "d5"]) b.move(m);
    const facts = lineMaterialFacts(b.fen(), ["exd5", "Qxd5"], "w");
    expect(facts.outcome).toBe("material stays equal (pawn trade)"); expect(facts.moves.map((m) => m.captureOutcome)).toEqual(["trade", "trade"]);
  });
  it("labels a bishop-for-knight exchange as a trade, not a material win", () => {
    const facts = lineMaterialFacts("r1bqkbnr/1p1n1ppp/p7/1Bpp4/3P4/5N2/PPP2PPP/RNBQK2R w KQkq - 0 7", ["Bxd7+", "Bxd7", "O-O", "c4"], "w");
    expect(facts.outcome).toBe("material stays equal (bishop trade)"); expect(facts.moves.slice(0, 2).map((m) => m.captureOutcome)).toEqual(["trade", "trade"]);
  });
  it("counts a bishop lost for a pawn and labels the unmatched bishop capture", () => {
    const facts = lineMaterialFacts("4k3/8/8/1pp5/B2P4/8/8/4K3 w - - 0 1", ["dxc5", "bxa4"], "w");
    expect(facts.outcome).toBe("you lose a bishop for a pawn"); expect(facts.moves[1]?.captureOutcome).toBe("wins material");
  });
  it("counts end material, preserving an existing unequal balance", () => expect(lineMaterialFacts("4k3/8/8/8/8/8/R7/4K3 w - - 0 1", ["Ra3"], "w").outcome).toBe("material balance stays unchanged (no net material gain)"));
  it("reports checkmate directly from the replayed board", () => {
    const b = new Chess(); for (const m of ["f3", "e5", "g4"]) b.move(m);
    expect(lineMaterialFacts(b.fen(), ["Qh4#"], "w").outcome).toBe("Played move allows checkmate");
  });
  it("counts promotion in the final inventory", () => expect(lineMaterialFacts("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", ["a8=Q+"], "w").outcome).toContain("your promotion adds a queen"));
});
