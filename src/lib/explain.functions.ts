import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { allowedExplanationOrigin, validateExplanationInput, EXPLANATION_MODEL, EXPLANATION_MAX_TOKENS } from "./explanation-security";

// Single source of truth, enforced atomically by the database (UTC days).
export const DAILY_EXPLANATION_LIMIT = 300;

export const explainMistake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateExplanationInput)
  .handler(async ({ data, context }) => {
    const failure: { text: null; error: string; status?: number } = { text: null, error: "Couldn't load the explanation. Try again." };
    if (!allowedExplanationOrigin(getRequest().headers.get("origin"), import.meta.env.DEV)) return failure;
    if (!data) return { text: null, error: "Please provide a valid position, move, line, and rating." };
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) return failure;
    try {
    // Authentication has already validated the caller. Privilege is limited to
    // incrementing their immutable quota and writing a server-generated cache.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allowed, error: quotaError } = await supabaseAdmin.rpc("consume_explanation_allowance", {
      p_user_id: context.userId, p_limit: DAILY_EXPLANATION_LIMIT,
    });
    if (quotaError) return failure;
    if (!allowed) return { text: null, error: "Your daily explanation allowance is used up. Try again tomorrow." };
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ ...data, model: EXPLANATION_MODEL, version: 1 })));
    const cacheKey = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    const { data: cached, error: cacheError } = await context.supabase.from("explanation_cache").select("explanation").eq("cache_key", cacheKey).maybeSingle();
    if (cacheError) return failure;
    if (cached) return { text: cached.explanation, error: null, status: 200 };
    const prompt = `Here is the position (FEN): ${data.fen}
Move played: ${data.played}
Stockfish's best line: ${data.bestLine.join(" ")}

Explain the mistake to a ${data.rating}-level player in 2–3 sentences. Only refer to moves in the engine line; never invent moves.`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EXPLANATION_MODEL,
        max_tokens: EXPLANATION_MAX_TOKENS,
        system: "You are Chess Yoda, a calm, concise chess coach. Plain text, no markdown. Use only the supplied legal moves.",
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429) return { ...failure, status: res.status };
    if (!res.ok) return { ...failure, status: res.status };
    const response = await res.json() as { content?: { type?: string; text?: string }[] };
    const text = (response.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("").trim();
    if (!text || text.length > 4000) return { ...failure, status: res.status };
    const { error: writeError } = await supabaseAdmin.from("explanation_cache").upsert({ cache_key: cacheKey, explanation: text }, { onConflict: "cache_key", ignoreDuplicates: true });
    if (writeError) return failure;
    return { text, error: null, status: res.status };
    } catch { return failure; }
  });
