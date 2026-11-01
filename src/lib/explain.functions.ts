import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { allowedExplanationOrigin, checkCoachingRecord, whySystemPrompt, EXPLANATION_MODEL, EXPLANATION_MAX_TOKENS } from "./explanation-security";
import { coachingFacts, completeExplanation } from "./coaching-facts";
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
    const checked = checkCoachingRecord(raw);
    if (!checked.ok) {
      logExplanationStep("input validation", checked.field);
      return fail(400, `Invalid input: ${checked.field}`, "Please provide a valid position, move, line, and rating.");
    }
    const data = coachingFacts(checked.record, checked.rating);
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
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ ...data, model: EXPLANATION_MODEL, version: 11 })));
      const cacheKey = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      const { data: cached, error: cacheError } = await context.supabase.from("explanation_cache").select("explanation").eq("cache_key", cacheKey).maybeSingle();
      if (cacheError) { logExplanationStep("cache lookup"); return fail(500, "Cache lookup failed"); }
      if (cached) return { text: completeExplanation(cached.explanation, null, 3), error: null, status: 200 };
      const prompt = `Chess facts:\n${JSON.stringify(data)}\nEach continuation is a separate alternative, not part of the played game. Use the net material outcomes exactly, including trades and promotions. Capture labels describe that capture within its complete line, not an extra gain beyond the net result. Do not invent attacked squares, defended pieces, pins, forks, pawn structure, bishop-pair claims or material advantages absent from the facts. Never claim initiative, passive pieces, removal of a defender, or control of a position: these facts are not included. For exchanges name both pieces exactly, e.g. a bishop exchanged for a knight is not a bishop-for-bishop trade. When both lines preserve material, say the alternative avoids the stated mistake without inventing a strategic reason. For checkmate focus on mate, not incidental capture labels. Exactly three short sentences; no evaluation numbers or internal-analysis language. Final wording must never contain 'engine', 'analysis', 'verified', 'supplied', 'data', 'evaluation' or 'provided'. Chess square names and SAN moves are allowed. Explain only the chess, not where the information came from.`;
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
            // Keep the budget available for the visible explanation.
            thinking: { type: "disabled" },
            system: whySystemPrompt(data.rating) + " The swingLabel is mistake severity, NEVER material loss: 'costs about a piece’s worth' must not be repeated as losing a piece when the material outcome is unchanged. If material balance stays unchanged, say only that the exchange gains no material, never that the player is level or lost material. Prefer plain net outcomes such as 'wins a pawn' over listing cancelling captures. Never say 'ahead', 'down', 'level', 'compensation', 'initiative', 'undefended', 'opens a line', 'weakened', or 'passive': these conclusions are not provided. Use 'loses a bishop for two pawns' or 'wins a pawn' literally, not a claim about total material balance. Keep each sentence short and describe only the net outcome, the named replies, and a general habit.",
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
        const response = await res.json() as { stop_reason?: string; content?: { type?: string; text?: string }[] };
        if (response.stop_reason === "refusal") return fail(403, "Explanation refused", "The explanation service declined this request.");
        text = completeExplanation((response.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join(""), response.stop_reason, 3);
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
