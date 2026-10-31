import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { GameSnapshot } from "./game-session";

export async function persistSession(id: string, snapshot: GameSnapshot) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await supabase.from("games").upsert({
    id, user_id: auth.user.id, status: "active", source: "play",
    player_color: snapshot.settings.color === "w" ? "white" : "black",
    opponent: `Stockfish ~${snapshot.settings.elo}`, opponent_elo: snapshot.settings.elo,
    coach_mode: snapshot.settings.coach, time_control: snapshot.settings.tc.id,
    moves: snapshot.records as unknown as Json, pgn: snapshot.pgn,
    current_fen: snapshot.fen, snapshot: snapshot as unknown as Json,
    takebacks: snapshot.takebacks, hints_used: snapshot.hintsUsed,
  });
  if (error) throw error;
}

export async function deleteSession(id: string) {
  const { error } = await supabase.from("games").delete().eq("id", id).eq("status", "active");
  if (error) throw error;
}