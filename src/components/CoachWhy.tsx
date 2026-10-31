import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Loader2 } from "lucide-react";
import { explainMistake } from "@/lib/explain.functions";
import type { MoveRecord } from "@/lib/types";
import { Button } from "./ui/button";
export function CoachWhy({ record, rating }: { record: MoveRecord; rating: number }) {
  const explain = useServerFn(explainMistake);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function ask() {
    setBusy(true);
    try {
      const result = await explain({ data: { fen: record.fenBefore, played: record.san, bestLine: record.bestLine.slice(0, 8), rating } });
      setText(result.text ?? result.error ?? "The coach couldn't answer right now.");
    } catch { setText("The coach couldn't answer right now."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2 space-y-2">
    <Button size="sm" variant="outline" onClick={ask} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HelpCircle className="h-4 w-4" />} Why?</Button>
    {text && <p className="text-sm leading-relaxed" role="status">{text}</p>}
  </div>;
}