import { Engine } from "./engine";
import { analyzeSkills } from "./skills";
import { supabase } from "@/integrations/supabase/client";
import type { MoveRecord } from "./types";
import type { Json } from "@/integrations/supabase/types";

const jobs = new Map<string, Promise<void>>();
export function completeSkillAnalysis(gameId: string): Promise<void> {
  const existing = jobs.get(gameId);
  if (existing) return existing;
  const job = (async () => {
    const { data: game, error } = await supabase.from("games").select("moves,skills_analyzed,hints_used").eq("id", gameId).single();
    if (error || !game) throw new Error("Game unavailable");
    if (game.skills_analyzed) return;
    const engine = new Engine();
    try {
      const records = game.moves as unknown as MoveRecord[];
      // Older hinted games do not identify assisted plies: exclude rather than guess.
      const input = game.hints_used && !records.some((m) => m.hintUsed !== undefined) ? records.map((m) => ({ ...m, hintUsed: true })) : records;
      const moves = await analyzeSkills(engine, input);
      const { error: saveError } = await supabase.from("games").update({ moves: moves as unknown as Json, skills_analyzed: true }).eq("id", gameId);
      if (saveError) throw new Error("Analysis save failed");
      for (const m of moves) if (m.byPlayer && m.skillTags?.length) {
        const { error: tagError } = await supabase.from("puzzles").update({ categories: [...new Set(m.skillTags.map((t) => t.axis))] }).eq("game_id", gameId).eq("source_move_key", `${m.ply}:${m.uci}`);
        if (tagError) throw new Error("Puzzle tags save failed");
      }
    } finally { engine.terminate(); }
  })();
  jobs.set(gameId, job);
  void job.finally(() => jobs.delete(gameId)).catch(() => {});
  return job;
}