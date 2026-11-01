import { Chess } from "chess.js";
import jStatPackage from "jstat";
import { nullMoveFen, pvToSan } from "./coach";
import type { Analysis, Engine } from "./engine";
import type { MoveRecord } from "./types";
const skillLoss = (record: MoveRecord) => (record.evalBefore - record.evalAfter) * (record.color === "w" ? 1 : -1);

export const SKILL_AXES = ["Opening play", "Tactics", "Positional play", "Endgames", "Defense", "Consistency"] as const;
export type SkillAxis = typeof SKILL_AXES[number];
export type SkillTag = { axis: SkillAxis; success: boolean };
export const SKILL_DEFINITIONS: Record<SkillAxis, string> = {
  "Opening play": "Moves 1–12 with evaluation loss below 50 centipawns.",
  Tactics: "Best move beats the alternative by at least 150 centipawns; choose within 50. First-try puzzles also count.",
  "Positional play": "Quiet, balanced choices with evaluation loss below 30 centipawns.",
  Endgames: "Queens off, at most six non-pawn pieces: loss below 50. Convert +3 positions into wins.",
  Defense: "Answer a null-move threat worth at least 150 centipawns with loss below 100.",
  Consistency: "One observation per game: no move losing 200 or more centipawns.",
};
export function radarEndgame(fen: string) {
  const pieces = new Chess(fen).board().flat().filter((p) => p && p.type !== "k" && p.type !== "p");
  return !pieces.some((p) => p?.type === "q") && pieces.length <= 6;
}
export function tagMove(record: MoveRecord, before: Analysis, threatGain: number | null): SkillTag[] {
  if (!record.byPlayer || record.hintUsed) return [];
  const loss = skillLoss(record);
  const tags: SkillTag[] = [];
  const number = new Chess(record.fenBefore).moveNumber();
  if (number <= 12) tags.push({ axis: "Opening play", success: loss < 50 });
  const sign = record.color === "w" ? 1 : -1;
  const first = before.lines[0]; const second = before.lines[1];
  const gap = first && second ? (first.cp - second.cp) * sign : null;
  if (gap !== null && gap >= 150) tags.push({ axis: "Tactics", success: record.uci === before.bestmove || loss <= 50 });
  const board = new Chess(record.fenBefore);
  let best;
  try { best = board.move({ from: before.bestmove.slice(0, 2), to: before.bestmove.slice(2, 4), promotion: before.bestmove[4] ?? "q" }); } catch { best = null; }
  if (gap !== null && Math.abs(gap) <= 50 && best && !best.captured && !/[+#]/.test(best.san) && Math.abs(record.evalBefore) < 300) tags.push({ axis: "Positional play", success: loss < 30 });
  if (radarEndgame(record.fenBefore)) tags.push({ axis: "Endgames", success: loss < 50 });
  if (threatGain !== null && threatGain >= 150) tags.push({ axis: "Defense", success: loss < 100 });
  if (record.threatAnswer !== undefined) tags.push({ axis: "Defense", success: record.threatAnswer });
  return tags;
}
export async function analyzeSkills(engine: Engine, records: MoveRecord[]) {
  const output: MoveRecord[] = [];
  for (const record of records) {
    if (!record.byPlayer || record.hintUsed) { output.push({ ...record, skillTags: [] }); continue; }
    const before = await engine.analyze(record.fenBefore, { depth: 14, multipv: 2 });
    const after = await engine.analyze(record.fenAfter, { depth: 14 });
    const nf = nullMoveFen(record.fenBefore);
    const passed = nf ? await engine.analyze(nf, { depth: 14 }) : null;
    const threatGain = passed ? ((before.lines[0]?.cp ?? 0) - (passed.lines[0]?.cp ?? 0)) * (record.color === "w" ? 1 : -1) : null;
    const updated = { ...record, evalBefore: before.lines[0]?.cp ?? record.evalBefore, evalAfter: after.lines[0]?.cp ?? record.evalAfter, mateAfter: after.lines[0]?.mate ?? null, bestUci: before.bestmove, bestLine: pvToSan(record.fenBefore, before.lines[0]?.pv ?? [], 4), replyLine: pvToSan(record.fenAfter, after.lines[0]?.pv ?? [], 4) };
    output.push({ ...updated, skillTags: tagMove(updated, before, threatGain) });
  }
  return output;
}
export type SkillGame = { id: string; created_at: string; result: string | null; player_color: string; moves: MoveRecord[]; skills_analyzed: boolean; hints_used?: number };
export type SkillPuzzle = { game_id: string | null; first_try_success: boolean | null; first_attempt_at?: string | null; last_attempt_at: string | null; created_at: string };
export function skillScores(games: SkillGame[], puzzles: SkillPuzzle[], cutoff = Date.now()) {
  const ordered = games.filter((g) => Date.parse(g.created_at) <= cutoff).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const evidence: Record<SkillAxis, { success: number; failure: number; count: number }> = Object.fromEntries(SKILL_AXES.map((a) => [a, { success: 0, failure: 0, count: 0 }])) as Record<SkillAxis, { success: number; failure: number; count: number }>;
  const add = (axis: SkillAxis, success: boolean, age: number) => { const e = evidence[axis]; e.count++; e[success ? "success" : "failure"] += Math.pow(0.97, age); };
  ordered.forEach((game, index) => {
    const age = ordered.length - index - 1;
    if (!game.skills_analyzed) return;
    const mine = game.moves.filter((m) => m.byPlayer && !m.hintUsed);
    for (const m of mine) for (const tag of m.skillTags ?? []) add(tag.axis, tag.success, age);
    // Old games with hint totals but no per-move markers cannot supply unbiased evidence.
    if (!(game.hints_used && !game.moves.some((m) => m.hintUsed !== undefined))) add("Consistency", !mine.some((m) => skillLoss(m) >= 200), age);
    const entered = mine.find((m) => radarEndgame(m.fenBefore));
    if (entered && entered.evalBefore * (entered.color === "w" ? 1 : -1) >= 300) add("Endgames", game.result === (game.player_color === "white" ? "1-0" : "0-1"), age);
  });
  for (const p of puzzles) if (p.first_try_success !== null && (p.first_attempt_at ?? p.last_attempt_at) && Date.parse(p.first_attempt_at ?? p.last_attempt_at ?? "") <= cutoff) {
    const after = ordered.filter((g) => Date.parse(g.created_at) > Date.parse(p.first_attempt_at ?? p.last_attempt_at ?? p.created_at)).length;
    add("Tactics", p.first_try_success, after);
  }
  return SKILL_AXES.map((axis) => { const e = evidence[axis]; const a = 2 + e.success; const b = 2 + e.failure;
    return { axis, count: e.count, score: e.count >= 15 ? a / (a + b) * 100 : null, low: jStatPackage.jStat.beta.inv(0.1, a, b) * 100, high: jStatPackage.jStat.beta.inv(0.9, a, b) * 100 };
  });
}