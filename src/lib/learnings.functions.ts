import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allowedExplanationOrigin, EXPLANATION_MODEL, LEARNINGS_MAX_TOKENS } from "./explanation-security";
import { coachingFacts, completeExplanation } from "./coaching-facts";
import { evalLoss } from "./coach";
import { Chess } from "chess.js";
import type { MoveRecord } from "./types";
import { logExplanationStep } from "./explain-diagnostics";

export const generateLearnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: { gameId: string }) => {
    if (!value || !/^[0-9a-f-]{36}$/i.test(value.gameId)) throw new Error("Invalid game");
    return value;
  })
  .handler(async ({ data, context }) => {
    if (!allowedExplanationOrigin(getRequest().headers.get("origin"), import.meta.env.DEV)) return { text: null, status: 403 };
    const { data: game, error } = await context.supabase.from("games").select("*").eq("id", data.gameId).eq("user_id", context.userId).eq("status", "completed").single();
    if (error || !game) return { text: null, status: 404 };
    const { data: existing } = await context.supabase.from("game_learnings").select("*").eq("game_id", data.gameId).maybeSingle();
    if (existing?.status === "completed") return { text: existing.content, status: 200 };
    if (existing?.status === "failed" && [403, 404].includes(existing.error_status ?? 0)) return { text: null, status: existing.error_status };
    const storedMoves = game.moves as unknown as MoveRecord[];
    const topMistakes = storedMoves.filter((m) => m.byPlayer && ["mistake", "blunder"].includes(m.label ?? "")).sort((a, b) => evalLoss(b.evalBefore, b.evalAfter, b.color) - evalLoss(a.evalBefore, a.evalAfter, a.color)).slice(0, 5);
    if (topMistakes.some((m) => !m.replyLine)) return { text: null, status: 422 };
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) return { text: null, status: 500 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_game_learnings", { p_game_id: data.gameId, p_user_id: context.userId });
    if (claimError || !claimed) return { text: null, status: claimError ? 500 : 202 };
    const { data: lease } = await supabaseAdmin.from("game_learnings").select("claim_token").eq("game_id", data.gameId).eq("user_id", context.userId).single();
    if (!lease) return { text: null, status: 500 };
    const fail = async (status: number) => {
      await supabaseAdmin.from("game_learnings").update({ status: "failed", error_status: status, updated_at: new Date().toISOString() }).eq("game_id", data.gameId).eq("user_id", context.userId).eq("claim_token", lease.claim_token);
      return { text: null, status };
    };
    try {
      const { data: profile } = await context.supabase.from("profiles").select("rating").eq("id", context.userId).maybeSingle();
      const rating = profile?.rating ?? 1400;
      const facts = topMistakes.map((m) => coachingFacts(m, rating));
      let opening = "Opening name unavailable";
      if (game.pgn) { const chess = new Chess(); chess.loadPgn(game.pgn); opening = chess.getHeaders()["Opening"] ?? opening; }
      // No raw positions, full game or invented opening names leave this boundary.
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: EXPLANATION_MODEL, max_tokens: LEARNINGS_MAX_TOKENS, thinking: { type: "disabled" },
          system: `You are a chess coach. All supplied moves are legal and engine analysis is correct: never question or recalculate them. Based only on these engine-verified facts, write 3–5 short bullet points of key learnings for a ${rating}-level player: what went wrong, the pattern behind it, and one concrete habit to practice. Only refer to moves provided; never invent moves. Keep each bullet under 25 words. No hedging, self-corrections, or preamble. If no mistakes were recorded, say that and give general practice habits without claiming game-specific weaknesses.`,
          messages: [{ role: "user", content: JSON.stringify({ rating, playerSide: game.player_color, result: game.result, opening, mistakes: facts }) }],
        }),
      });
      if (!res.ok) { logExplanationStep("anthropic call", res.status); return fail(res.status); }
      const body = await res.json() as { stop_reason?: string; content?: { type: string; text?: string }[] };
      if (body.stop_reason === "refusal") return fail(403);
      const text = completeExplanation((body.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join(""), body.stop_reason);
      if (!text || text.length > 4000) { logExplanationStep("response parsing"); return fail(502); }
      const { error: writeError } = await supabaseAdmin.from("game_learnings").update({ status: "completed", content: text, updated_at: new Date().toISOString(), error_status: null }).eq("game_id", data.gameId).eq("user_id", context.userId).eq("claim_token", lease.claim_token);
      if (writeError) return fail(500);
      return { text, status: 200 };
    } catch { logExplanationStep("unexpected error"); return fail(500); }
  });