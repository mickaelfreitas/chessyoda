import { supabase } from "@/integrations/supabase/client";
import type { MoveRecord } from "./types";
import type { Json } from "@/integrations/supabase/types";

export type NewGame = {
  source: "play" | "lichess" | "chesscom";
  externalId?: string;
  playerColor: "white" | "black";
  opponent: string;
  opponentElo?: number | null;
  coachMode: string;
  timeControl?: string | null;
  result: string;
  pgn: string;
  moves: MoveRecord[];
  takebacks: number;
  createdAt?: string;
};

async function requireUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

/** Save a game and turn the player's mistakes and blunders into puzzles. Returns the game id. */
export async function saveGame(g: NewGame): Promise<string> {
  const userId = await requireUserId();
  const mine = g.moves.filter((m) => m.byPlayer);
  const count = (l: string) => mine.filter((m) => m.label === l).length;
  const { data, error } = await supabase
    .from("games")
    .insert({
      user_id: userId,
      source: g.source,
      external_id: g.externalId ?? null,
      player_color: g.playerColor,
      opponent: g.opponent,
      opponent_elo: g.opponentElo ?? null,
      coach_mode: g.coachMode,
      time_control: g.timeControl ?? null,
      result: g.result,
      pgn: g.pgn,
      moves: g.moves as unknown as Json,
      takebacks: g.takebacks,
      blunders: count("blunder"),
      mistakes: count("mistake"),
      inaccuracies: count("inaccuracy"),
      ...(g.createdAt ? { created_at: g.createdAt } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  const puzzles = mine
    .filter((m) => (m.label === "mistake" || m.label === "blunder") && m.bestUci)
    .map((m) => ({
      user_id: userId,
      game_id: data.id,
      fen: m.fenBefore,
      played_san: m.san,
      best_uci: m.bestUci,
      best_san: m.bestLine[0] ?? null,
      best_line: m.bestLine.join(" "),
      severity: m.label!,
      mistake_type: m.mistakeType ?? "missed_tactic",
    }));
  if (puzzles.length) {
    const { error: pe } = await supabase.from("puzzles").insert(puzzles);
    if (pe) throw pe;
  }
  return data.id;
}

export async function existingExternalIds(source: string): Promise<Set<string>> {
  const { data } = await supabase.from("games").select("external_id").eq("source", source).not("external_id", "is", null);
  return new Set((data ?? []).map((r) => r.external_id!));
}
