import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { generateLearnings } from "@/lib/learnings.functions";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";

export function KeyLearnings({ gameId }: { gameId: string }) {
  const generate = useServerFn(generateLearnings);
  const queryClient = useQueryClient();
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<number>(202);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const result = await generate({ data: { gameId } });
      setText(result.text); setStatus(result.status ?? 500);
      if (result.text) void queryClient.invalidateQueries({ queryKey: ["learnings"] });
    } catch { setStatus(500); } finally { setBusy(false); }
  }
  useEffect(() => { void run(); }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (busy || status !== 202) return;
    // Poll stored state only; never replay the AI call.
    const timer = setTimeout(async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("game_learnings").select("status,content,error_status").eq("game_id", gameId).maybeSingle();
      if (data?.status === "completed") { setText(data.content); setStatus(200); }
      else if (data?.status === "failed") setStatus(data.error_status ?? 500);
      else setStatus(500);
    }, 3000);
    return () => clearTimeout(timer);
  }, [gameId, busy, status]);
  return <section className="space-y-3 border-t border-border py-4" aria-label="Key learnings">
    <h2 className="text-sm font-semibold">Key learnings</h2>
    {busy ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparing learnings…</p> : text ? <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">{text.split("\n").filter((s) => s.trim()).map((line, i) => <li key={i}>{line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")}</li>)}</ul> : <div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Learnings unavailable</span><Button size="sm" variant="outline" onClick={run} disabled={[403, 404].includes(status)}>Retry</Button></div>}
  </section>;
}