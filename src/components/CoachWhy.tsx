import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, Loader2 } from "lucide-react";
import { explainMistake } from "@/lib/explain.functions";
import type { MoveRecord } from "@/lib/types";
import { Button } from "./ui/button";
import { Engine } from "@/lib/engine";
import { pvToSan } from "@/lib/coach";

const GENERIC = "Couldn't load the explanation. Try again.";

export function CoachWhy({ record, rating }: { record: MoveRecord; rating: number }) {
  const explain = useServerFn(explainMistake);
  const [text, setText] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function ask() {
    setBusy(true);
    setFailed(false);
    setDebug(null);
    try {
      let replyLine = record.replyLine;
      if (!replyLine) {
        const engine = new Engine();
        try {
          const analysis = await engine.analyze(record.fenAfter, { depth: 14 });
          replyLine = pvToSan(record.fenAfter, analysis.lines[0]?.pv ?? [], 4);
        } finally { engine.terminate(); }
      }
      const result = await explain({ data: { record: { ...record, bestLine: record.bestLine.slice(0, 4), replyLine }, rating: Math.round(rating) } });
      setFailed(!result.text);
      setText(result.text ?? result.error ?? GENERIC);
      if (import.meta.env.DEV && !result.text) setDebug(`HTTP ${result.status ?? "?"} — ${result.reason ?? "No reason given"}`);
    } catch (error) {
      setFailed(true);
      setText(GENERIC);
      if (import.meta.env.DEV) {
        const message = error instanceof Error ? error.message : "Request failed";
        setDebug(`HTTP ${/unauthorized/i.test(message) ? 401 : "?"} — ${/unauthorized/i.test(message) ? "Auth check failed" : "Request failed"}`);
      }
    }
    finally { setBusy(false); }
  }
  return <div className="mt-2 space-y-2">
    <Button size="sm" variant="outline" onClick={ask} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HelpCircle className="h-4 w-4" />} {failed ? "Retry" : "Why?"}</Button>
    {text && <p className="text-sm leading-relaxed" role="status">{text}</p>}
    {debug && <p className="font-mono text-xs text-muted-foreground" data-testid="explain-debug">Preview only: {debug}</p>}
  </div>;
}
