import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { allowedExplanationOrigin, checkExplanationInput, EXPLANATION_MODEL, EXPLANATION_MAX_TOKENS } from "./explanation-security";
import { logExplanationStep } from "./explain-diagnostics";

// Single source of truth, enforced atomically by the database (UTC days).
export const DAILY_EXPLANATION_LIMIT = 300;

export type ExplanationResult = { text: string | null; error: string | null; status?: number; reason?: string };

const GENERIC = "Couldn't load the explanation. Try again.";

// Runs before the auth middleware so a rejected session is logged by step name only.
const logAuthFailure = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try { return await next(); } catch (error) { logExplanationStep("auth check"); throw error; }
});

export const explainMistake = createServerFn({ method: "POST" })
  .middleware([logAuthFailure, requireSupabaseAuth])
  .inputValidator((value: unknown) => value)
  .handler(async ({ data: raw, context }): Promise<ExplanationResult> => {
    // Reasons are fixed strings and only returned by the development preview server.
    const fail = (status: number, reason: string, error = GENERIC): ExplanationResult =>
      import.meta.env.DEV ? { text: null, error, status, reason } : { text: null, error, status };
    if (!allowedExplanationOrigin(getRequest().headers.get("origin"), import.meta.env.DEV)) {
      logExplanationStep("origin check");
      return fail(403, "Origin not allowed");
    }
    const checked = checkExplanationInput(raw);
    if (!checked.ok) {
      logExplanationStep("input validation", checked.field);
      return fail(400, `Invalid input: ${checked.field}`, "Please provide a valid position, move, line, and rating.");
    }
    const data = checked.data;
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) { logExplanationStep("configuration"); return fail(500, "Explanation service not configured"); }
    try {
      // Authentication has already validated the caller. Privilege is limited to
      // incrementing their immutable quota and writing a server-generated cache.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: allowed, error: quotaError } = await supabaseAdmin.rpc("consume_explanation_allowance", {
        p_user_id: context.userId, p_limit: DAILY_EXPLANATION_LIMIT,
      });
      if (quotaError) { logExplanationStep("daily limit"); return fail(500, "Daily limit check failed"); }
      if (!allowed) { logExplanationStep("daily limit"); return fail(429, "Daily limit reached", "Your daily explanation allowance is used up. Try again tomorrow."); }
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ ...data, model: EXPLANATION_MODEL, version: 1 })));
      const cacheKey = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      const { data: cached, error: cacheError } = await context.supabase.from("explanation_cache").select("explanation").eq("cache_key", cacheKey).maybeSingle();
      if (cacheError) { logExplanationStep("cache lookup"); return fail(500, "Cache lookup failed"); }
      if (cached) return { text: cached.explanation, error: null, status: 200 };
      const prompt = `Here is the position (FEN): ${data.fen}
Move played: ${data.played}
Stockfish's best line: ${data.bestLine.join(" ")}

Explain the mistake to a ${data.rating}-level player in 2–3 sentences. Only refer to moves in the engine line; never invent moves.`;
      let res: Response;
      try {
        res = await fetch("https://api.anthropic.com/v1/messages", {
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
      } catch {
        logExplanationStep("anthropic call");
        return fail(504, "Anthropic request failed or timed out");
      }
      if (!res.ok) {
        logExplanationStep("anthropic call", res.status);
        return fail(res.status, `Anthropic returned HTTP ${res.status}`);
      }
      let text = "";
      try {
        const response = await res.json() as { content?: { type?: string; text?: string }[] };
        text = (response.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("").trim();
      } catch { text = ""; }
      if (!text || text.length > 4000) { logExplanationStep("response parsing"); return fail(502, "Anthropic response had no usable text"); }
      const { error: writeError } = await supabaseAdmin.from("explanation_cache").upsert({ cache_key: cacheKey, explanation: text }, { onConflict: "cache_key", ignoreDuplicates: true });
      // The explanation is already generated; a cache miss next time is harmless.
      if (writeError) logExplanationStep("cache write");
      return { text, error: null, status: res.status };
    } catch {
      logExplanationStep("unexpected error");
      return fail(500, "Unexpected server error");
    }
  });
