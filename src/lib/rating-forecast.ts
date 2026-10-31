import { Glicko2 } from "glicko2";
export const FORECAST_UNLOCK_GAMES = 20;
export const FORECAST_WEEKS = 8;
export const INTERCEPT_STEP = 10;
export const SLOPE_STEP = 0.5;
const WEEK = 7 * 86400000;
export type RatedResult = { elo: number; score: number; date: string };
type ForecastGame = { source: string; status?: string; rated: boolean; takebacks: number; hints_used: number; opponent_elo: number | null; result: string | null; player_color: string; created_at: string };
export function ratedResults(games: ForecastGame[]): RatedResult[] {
  return games.filter((g) => g.source === "play" && g.rated && g.takebacks === 0 && g.hints_used === 0 && g.opponent_elo !== null && ["1-0", "0-1", "1/2-1/2"].includes(g.result ?? ""))
    .map((g) => ({ elo: g.opponent_elo ?? 1500, score: g.result === "1/2-1/2" ? 0.5 : (g.result === "1-0") === (g.player_color === "white") ? 1 : 0, date: g.created_at }))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
export function ratingHistory(results: RatedResult[]) {
  let rating = 1500, rd = 350, vol = 0.06;
  return results.map((result) => {
    const system = new Glicko2({ tau: 0.5 });
    const player = system.makePlayer(rating, rd, vol);
    // Fixed-strength engines are treated as known opponents, not mutable players.
    const opponent = system.makePlayer(result.elo, 30, 0.06);
    system.updateRatings([[player, opponent, result.score]]);
    rating = player.getRating(); rd = player.getRd(); vol = player.getVol();
    return { date: result.date, rating, rd };
  });
}
export function performancePrior(results: RatedResult[]) {
  const first = results.slice(0, 5);
  if (!first.length) return 1500;
  const score = first.reduce((sum, game) => sum + game.score, 0);
  let low = 0, high = 3500;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const expected = first.reduce((sum, game) => sum + 1 / (1 + 10 ** ((game.elo - mid) / 400)), 0);
    if (expected < score) low = mid; else high = mid;
  }
  return (low + high) / 2;
}
const softplus = (x: number) => Math.max(x, 0) + Math.log1p(Math.exp(-Math.abs(x)));
export function forecastRating(results: RatedResult[], now: number = Date.now()) {
  if (results.length < FORECAST_UNLOCK_GAMES) return null;
  const start = Date.parse(results[0]?.date ?? "");
  const mean = Math.round(performancePrior(results) / INTERCEPT_STEP) * INTERCEPT_STEP;
  const intercepts = 241, slopes = 289;
  const weights = new Float64Array(intercepts * slopes);
  const games = results.map((g) => ({ t: (Date.parse(g.date) - start) / WEEK, elo: g.elo, score: g.score }));
  let maxLog = -Infinity;
  for (let i = 0; i < intercepts; i++) {
    const r0 = mean - 1200 + i * INTERCEPT_STEP;
    for (let j = 0; j < slopes; j++) {
      const slope = -72 + j * SLOPE_STEP;
      let log = -0.5 * ((r0 - mean) / 200) ** 2 - 0.5 * (slope / 12) ** 2;
      for (const game of games) {
        const x = Math.LN10 / 400 * (r0 + slope * game.t - game.elo);
        log += game.score * -softplus(-x) + (1 - game.score) * -softplus(x);
      }
      weights[i * slopes + j] = log;
      maxLog = Math.max(maxLog, log);
    }
  }
  let sum = 0, improving = 0;
  for (let i = 0; i < weights.length; i++) { weights[i] = Math.exp((weights[i] ?? -Infinity) - maxLog); sum += weights[i] ?? 0; }
  for (let i = 0; i < weights.length; i++) {
    weights[i] = (weights[i] ?? 0) / sum;
    if (-72 + (i % slopes) * SLOPE_STEP > 0) improving += weights[i] ?? 0;
  }
  const points = Array.from({ length: FORECAST_WEEKS + 1 }, (_, week) => {
    const at = now + week * WEEK;
    const t = (at - start) / WEEK;
    const distribution: { rating: number; weight: number }[] = [];
    for (let i = 0; i < intercepts; i++) for (let j = 0; j < slopes; j++) {
      const weight = weights[i * slopes + j] ?? 0;
      if (weight > 1e-12) distribution.push({ rating: mean - 1200 + i * INTERCEPT_STEP + (-72 + j * SLOPE_STEP) * t, weight });
    }
    distribution.sort((a, b) => a.rating - b.rating);
    const quantile = (probability: number) => {
      let cumulative = 0;
      for (const value of distribution) { cumulative += value.weight; if (cumulative >= probability) return value.rating; }
      return distribution.at(-1)?.rating ?? mean;
    };
    return { date: new Date(at).toISOString(), median: quantile(0.5), lower: quantile(0.1), upper: quantile(0.9) };
  });
  return { points, improving, priorMean: mean };
}
export function rollingBlunders(games: { blunders: number }[]) {
  return games.map((g, i) => {
    const window = games.slice(Math.max(0, i - 9), i + 1);
    return { n: i + 1, blunders: g.blunders, average: window.reduce((sum, game) => sum + game.blunders, 0) / window.length };
  });
}