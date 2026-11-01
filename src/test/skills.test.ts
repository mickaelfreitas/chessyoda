import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { radarEndgame, skillScores, tagMove, type SkillGame } from "@/lib/skills";
import type { MoveRecord } from "@/lib/types";
import type { Analysis } from "@/lib/engine";
const chess = new Chess(); const fenBefore = chess.fen(); chess.move("e4");
const record: MoveRecord = { ply: 1, fenBefore, fenAfter: chess.fen(), san: "e4", uci: "e2e4", color: "w", evalBefore: 20, evalAfter: 0, mateAfter: null, bestUci: "e2e4", bestLine: ["e4"], byPlayer: true };
const analysis: Analysis = { bestmove: "e2e4", depth: 14, lines: [{ cp: 20, mate: null, pv: ["e2e4"] }, { cp: 0, mate: null, pv: ["d2d4"] }] };
const game = (id: string, moves: MoveRecord[]): SkillGame => ({ id, moves, created_at: "2026-10-01", player_color: "white", result: "1-0", skills_analyzed: true });
describe("skill evidence rules", () => {
  it("opening success requires strictly less than 50 centipawns", () => { expect(tagMove({ ...record, evalBefore: 50 }, analysis, null).find((t) => t.axis === "Opening play")?.success).toBe(false); expect(tagMove({ ...record, evalBefore: 49 }, analysis, null).find((t) => t.axis === "Opening play")?.success).toBe(true); });
  it("opening observations stop after move 12", () => { const c = new Chess(fenBefore); const fen = c.fen().replace(/ 1$/, " 13"); expect(tagMove({ ...record, fenBefore: fen }, analysis, null).some((t) => t.axis === "Opening play")).toBe(false); });
  it("tactics require a 150cp gap and accept moves within 50", () => { const a = { ...analysis, bestmove: "d2d4", lines: [{ cp: 150, mate: null, pv: [] }, { cp: 0, mate: null, pv: [] }] }; expect(tagMove({ ...record, evalBefore: 50 }, a, null).find((t) => t.axis === "Tactics")?.success).toBe(true); expect(tagMove({ ...record, evalBefore: 51 }, a, null).find((t) => t.axis === "Tactics")?.success).toBe(false); });
  it("quiet positional success requires loss below 30", () => { expect(tagMove({ ...record, evalBefore: 30 }, analysis, null).find((t) => t.axis === "Positional play")?.success).toBe(false); expect(tagMove(record, analysis, null).find((t) => t.axis === "Positional play")?.success).toBe(true); });
  it("quiet positions exclude absolute evaluations of 300", () => expect(tagMove({ ...record, evalBefore: 300 }, analysis, null).some((t) => t.axis === "Positional play")).toBe(false));
  it("endgames require queens off and at most six non-pawn non-king pieces", () => { expect(radarEndgame("4k3/8/8/8/8/8/R7/4K3 w - - 0 1")).toBe(true); expect(radarEndgame("4k3/8/8/8/8/8/Q7/4K3 w - - 0 1")).toBe(false); expect(radarEndgame(fenBefore)).toBe(false); });
  it("defense requires threat gain of 150 and loss below 100", () => { expect(tagMove({ ...record, evalBefore: 100 }, analysis, 150).find((t) => t.axis === "Defense")?.success).toBe(false); expect(tagMove(record, analysis, 149).some((t) => t.axis === "Defense")).toBe(false); });
  it("skips all hinted move observations", () => expect(tagMove({ ...record, hintUsed: true }, analysis, 200)).toEqual([]));
  it("consistency fails at loss 200 and supplies one observation per game", () => { const result = skillScores([game("1", [{ ...record, evalBefore: 200 }])], []); const consistency = result.find((s) => s.axis === "Consistency"); expect(consistency?.count).toBe(1); expect(consistency?.low).toBeLessThan(50); });
  it("uses Beta(2,2), 0.97 recency weights and requires 15 observations", () => {
    const games = Array.from({ length: 15 }, (_, i) => game(String(i), [{ ...record, skillTags: [{ axis: "Tactics", success: i === 14 }] }]));
    const score = skillScores(games, []).find((s) => s.axis === "Tactics"); const failures = Array.from({ length: 14 }, (_, i) => Math.pow(0.97, 14 - i)).reduce((a, b) => a + b, 0);
    expect(score?.score).toBeCloseTo(3 / (5 + failures) * 100, 6); expect(score?.low).toBeLessThan(score?.score ?? 0); expect(score?.high).toBeGreaterThan(score?.score ?? 0);
    expect(skillScores(games.slice(0, 14), []).find((s) => s.axis === "Tactics")?.score).toBeNull();
  });
  it("counts a puzzle's first try only", () => { expect(skillScores([], [{ game_id: null, first_try_success: false, last_attempt_at: "2026-10-01", created_at: "2026-10-01" }]).find((s) => s.axis === "Tactics")?.count).toBe(1); expect(skillScores([], [{ game_id: null, first_try_success: null, last_attempt_at: null, created_at: "2026-10-01" }]).find((s) => s.axis === "Tactics")?.count).toBe(0); });
});