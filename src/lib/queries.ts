import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MoveRecord } from "./types";

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    return data;
  },
});

export const gamesQuery = queryOptions({
  queryKey: ["games"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("games")
      .select("id, source, opponent, opponent_elo, player_color, result, coach_mode, takebacks, hints_used, rated, blunders, mistakes, inaccuracies, created_at, time_control")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data;
  },
});

export const gameQuery = (id: string) =>
  queryOptions({
    queryKey: ["game", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("games").select("*").eq("id", id).single();
      if (error) throw error;
      return { ...data, moves: data.moves as unknown as MoveRecord[] };
    },
  });

export const unfinishedGamesQuery = queryOptions({
  queryKey: ["unfinished-games"],
  queryFn: async () => {
    const { data, error } = await supabase.from("games").select("*").eq("status", "active").order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const puzzlesQuery = queryOptions({
  queryKey: ["puzzles"],
  queryFn: async () => {
    const { data, error } = await supabase.from("puzzles").select("*").order("created_at", { ascending: true }).limit(1000);
    if (error) throw error;
    return data;
  },
});

export const learningsQuery = queryOptions({
  queryKey: ["learnings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("game_learnings").select("game_id,content,updated_at").eq("status", "completed").order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const skillGamesQuery = queryOptions({
  queryKey: ["skill-games"],
  queryFn: async () => {
    const { data, error } = await supabase.from("games").select("id,created_at,result,player_color,moves,skills_analyzed,hints_used").eq("status", "completed").order("created_at", { ascending: true });
    if (error) throw error;
    return data.map((g) => ({ ...g, moves: g.moves as unknown as MoveRecord[] }));
  },
});

export function cssVar(name: string) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
