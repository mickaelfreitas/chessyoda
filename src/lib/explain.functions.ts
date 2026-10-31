import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Daily allowance; enforcement requires a confirmed durable quota counter.
export const DAILY_EXPLANATION_LIMIT = 300;

export const explainMistake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fen: z.string().max(120),
        played: z.string().max(12),
        bestLine: z.array(z.string().max(12)).max(12),
        rating: z.number().int().min(100).max(3500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { text: null, error: "AI is not configured." };
    const prompt = `Here is the position (FEN): ${data.fen}
Move played: ${data.played}
Stockfish's best line: ${data.bestLine.join(" ")}

Explain the mistake to a ${data.rating}-level player in 2–3 sentences. Only refer to moves in the engine line; never invent moves.`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: "You are Chess Yoda, a calm, concise chess coach. Plain text, no markdown.",
        input: prompt,
      }),
    });
    if (res.status === 429) return { text: null, error: "Too many requests — try again in a moment." };
    if (res.status === 402) return { text: null, error: "AI credits are used up for this workspace." };
    if (!res.ok || !res.body) return { text: null, error: "The coach couldn't answer right now." };

    // Consume the SSE stream and collect text deltas.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const ev of events) {
        for (const line of ev.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload) as { type?: string; delta?: string };
            if (j.type === "response.output_text.delta" && j.delta) text += j.delta;
          } catch {
            /* ignore partial */
          }
        }
      }
    }
    return { text: text.trim() || null, error: text.trim() ? null : "The coach had nothing to say." };
  });
