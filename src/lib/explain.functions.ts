import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    if (!apiKey) throw new Error("AI is not configured");
    const prompt = `Here is the position (FEN): ${data.fen}
Move played: ${data.played}
Stockfish's best line: ${data.bestLine.join(" ")}

Explain the mistake to a ${data.rating}-level player in 2–3 sentences. Only refer to moves in the engine line; never invent moves.`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are Chess Yoda, a calm, concise chess coach." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.status === 429) return { text: null, error: "Too many requests — try again in a moment." };
    if (res.status === 402) return { text: null, error: "AI credits are used up for this workspace." };
    if (!res.ok) return { text: null, error: "The coach couldn't answer right now." };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { text: json.choices?.[0]?.message?.content?.trim() ?? "", error: null };
  });
