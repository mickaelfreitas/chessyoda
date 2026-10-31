import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { Glicko2 } from "glicko2";
import { MATERIAL_VALUES, DEFAULT_GAME_OPTIONS, materialAt, isRatedUsage, legalTargets, restoreChess, type GameSnapshot } from "@/lib/game-session";
import { forecastRating, ratedResults, rollingBlunders, ratingHistory, FORECAST_UNLOCK_GAMES, FORECAST_WEEKS, INTERCEPT_STEP, SLOPE_STEP } from "@/lib/rating-forecast";
describe("material and game rules", () => {
  it("allows take-backs by default", () => expect(DEFAULT_GAME_OPTIONS.allowTakebacks).toBe(true));
  it("shows possible moves by default", () => expect(DEFAULT_GAME_OPTIONS.showPossibleMoves).toBe(true));
  it("uses pawn1 knight3 bishop3 rook5 queen9", () => expect(MATERIAL_VALUES).toMatchObject({ p: 1, n: 3, b: 3, r: 5, q: 9 }));
  it("tracks captured pieces and the advantage at the selected ply", () => {
    expect(materialAt(["e4", "d5", "exd5"]).captured.w).toEqual(["p"]);
    expect(materialAt(["e4", "d5", "exd5"]).advantage).toEqual({ w: 1, b: 0 });
    expect(materialAt(["e4", "d5", "exd5"], 2).advantage.w).toBe(0);
  });
  it("requires zero takebacks for a rated game", () => { expect(isRatedUsage(0, 0)).toBe(true); expect(isRatedUsage(1, 0)).toBe(false); });
  it("requires zero hints for a rated game", () => expect(isRatedUsage(0, 1)).toBe(false));
  it("shows legal targets and marks captures", () => {
    expect(legalTargets(new Chess().fen(), "e2").map((t) => t.square)).toEqual(["e3", "e4"]);
    const c = new Chess(); c.move("e4"); c.move("d5");
    expect(legalTargets(c.fen(), "e4")).toContainEqual({ square: "d5", capture: true });
  });
  it("restores PGN and repetition rather than only FEN", () => {
    const c = new Chess(); for (const san of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]) c.move(san);
    const snapshot = { pgn: c.pgn(), fen: c.fen() } as GameSnapshot;
    expect(restoreChess(snapshot).isThreefoldRepetition()).toBe(true);
    expect(restoreChess(snapshot).history()).toEqual(c.history());
  });
});
describe("rating and forecast", () => {
  it("matches the official Glicko-2 example", () => {
    const system = new Glicko2({ tau: 0.5 });
    const player = system.makePlayer(1500, 200, 0.06);
    system.updateRatings([[player, system.makePlayer(1400, 30), 1], [player, system.makePlayer(1550, 100), 0], [player, system.makePlayer(1700, 300), 0]]);
    expect(player.getRating()).toBeCloseTo(1464.06, 1); expect(player.getRd()).toBeCloseTo(151.52, 1);
  });
  it("excludes unrated, hinted and imported games", () => {
    const base = { source: "play", rated: true, takebacks: 0, hints_used: 0, opponent_elo: 1600, result: "1/2-1/2", player_color: "white", created_at: "2026-01-01" };
    expect(ratedResults([base, { ...base, rated: false }, { ...base, takebacks: 1 }, { ...base, hints_used: 1 }, { ...base, source: "lichess" }])).toEqual([{ elo: 1600, score: 0.5, date: "2026-01-01" }]);
  });
  it("unlocks only at 20 rated games", () => { expect(FORECAST_UNLOCK_GAMES).toBe(20); expect(forecastRating(Array.from({ length: 19 }, () => ({ elo: 1500, score: 0.5, date: "2026-01-01" })))).toBeNull(); });
  it("uses the requested grid steps", () => { expect(INTERCEPT_STEP).toBe(10); expect(SLOPE_STEP).toBe(0.5); });
  it("forecasts eight weeks with ordered 80% bounds", () => {
    const results = Array.from({ length: 20 }, (_, i) => ({ elo: 1500, score: 0.5, date: new Date(Date.UTC(2026, 0, 1 + i * 7)).toISOString() }));
    const forecast = forecastRating(results, Date.UTC(2026, 5, 1));
    expect(FORECAST_WEEKS).toBe(8); expect(forecast?.points).toHaveLength(9);
    for (const point of forecast?.points ?? []) { expect(point.lower).toBeLessThanOrEqual(point.median); expect(point.median).toBeLessThanOrEqual(point.upper); }
    expect(forecast?.improving).toBeGreaterThan(0.35); expect(forecast?.improving).toBeLessThan(0.65);
    expect(ratingHistory(results).at(-1)?.rating).toBeCloseTo(1500, 0);
  });
  it("uses only the last ten blunder counts", () => { const series = rollingBlunders([{ blunders: 100 }, ...Array.from({ length: 10 }, () => ({ blunders: 2 }))]); expect(series.at(-1)?.average).toBe(2); });
});