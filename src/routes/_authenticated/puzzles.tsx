import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Check, X } from "lucide-react";

import { Board, sq } from "@/components/Board";
import { Button } from "@/components/ui/button";
import { Engine } from "@/lib/engine";
import { capEval } from "@/lib/coach";
import { cssVar, puzzlesQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SKILL_AXES } from "@/lib/skills";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/puzzles")({
  validateSearch: (search: Record<string, unknown>): { category?: string } => {
    const category = search["category"];
    return typeof category === "string" && SKILL_AXES.some((a) => a === category) ? { category } : {};
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "My puzzles — Chess Yoda" },
      { name: "description", content: "Find the better move in positions from your own games." },
      { property: "og:title", content: "My puzzles — Chess Yoda" },
      { property: "og:description", content: "Find the better move in positions from your own games." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(puzzlesQuery),
  component: Puzzles,
});

const ACCEPT_MARGIN = 50; // a move within 0.5 pawns of the best counts as solved

function Puzzles() {
  const { category } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: puzzles } = useSuspenseQuery(puzzlesQuery);
  const queryClient = useQueryClient();
  // Failed first (repeat until solved), then new.
  const filtered = useMemo(() => puzzles.filter((p) => !category || p.categories.includes(category)), [puzzles, category]);
  const queue = useMemo(() => [...filtered.filter((p) => p.status === "failed"), ...filtered.filter((p) => p.status === "new")], [filtered]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = filtered.find((p) => p.id === currentId) ?? queue[0] ?? null;
  const filter = <Select value={category ?? "all"} onValueChange={(value) => { setCurrentId(null); void navigate({ search: value === "all" ? {} : { category: value } }); }}><SelectTrigger aria-label="Puzzle category" className="shadow-none"><SelectValue /></SelectTrigger><SelectContent className="shadow-none"><SelectItem value="all">All categories</SelectItem>{SKILL_AXES.filter((a) => a !== "Consistency").map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>;
  const [fen, setFen] = useState(current?.fen ?? "");
  const [result, setResult] = useState<null | "solved" | "failed">(null);
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState<Square | null>(null);
  const engine = useRef<Engine | null>(null);
  const bestEval = useRef<Promise<number> | null>(null);
  const attemptInFlight = useRef(false);

  useEffect(() => {
    engine.current = new Engine();
    return () => engine.current?.terminate();
  }, []);

  useEffect(() => {
    if (!current) return;
    setFen(current.fen);
    setResult(null);
    setSelected(null);
    bestEval.current = null;
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const solved = puzzles.filter((p) => p.status === "solved").length;
  const failedTotal = puzzles.reduce((s, p) => s + p.failed_count, 0);
  const solvedTotal = puzzles.reduce((s, p) => s + p.solved_count, 0);

  if (!current) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-xl border bg-card p-6 text-center">
        <h1 className="text-2xl font-bold">{puzzles.length ? "All caught up" : "No puzzles yet"}</h1>
        {filter}
        <p className="text-muted-foreground">
          {puzzles.length ? `You've solved all ${solved} puzzles.` : "Your mistakes from played or imported games become puzzles here."}
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild><Link to="/play">Play</Link></Button>
          <Button asChild variant="outline"><Link to="/import">Import games</Link></Button>
        </div>
      </div>
    );
  }

  const turn = current.fen.split(" ")[1] === "w" ? "w" : "b";
  const sign = turn === "w" ? 1 : -1;

  async function attempt(from: string, to: string) {
    if (attemptInFlight.current || result || checking || !current) return false;
    const c = new Chess(current.fen);
    let m;
    try {
      m = c.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    attemptInFlight.current = true;
    try {
    setFen(c.fen());
    setSelected(null);
    let ok = m.from + m.to === current.best_uci.slice(0, 4);
    if (!ok) {
      setChecking(true);
      const activeEngine = engine.current;
      if (!activeEngine) { setChecking(false); return false; }
      bestEval.current ??= activeEngine.analyze(current.fen, { depth: 12 }).then((a) => a.lines[0]?.cp ?? 0);
      const [best, after] = await Promise.all([bestEval.current, activeEngine.analyze(c.fen(), { depth: 12 })]);
      ok = (capEval(best) - capEval(after.lines[0]?.cp ?? 0)) * sign <= ACCEPT_MARGIN;
      setChecking(false);
    }
    const r = ok ? "solved" : "failed";
    setResult(r);
    const { error } = await supabase
      .from("puzzles")
      .update({
        status: r,
        attempts: current.attempts + 1,
        solved_count: current.solved_count + (ok ? 1 : 0),
        failed_count: current.failed_count + (ok ? 0 : 1),
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", current.id);
    if (error) throw new Error("Puzzle save failed");
    return true;
    } catch { toast.error("Couldn't save your puzzle attempt. Try again."); setResult(null); setFen(current.fen); return false; }
    finally { attemptInFlight.current = false; setChecking(false); }
  }

  function next() {
    if (!current) return;
    const remaining = queue.filter((p) => p.id !== current.id);
    // Failed puzzles go to the back of the queue so they repeat.
    const nextP = remaining[0] ?? (result === "failed" ? current : null);
    void queryClient.invalidateQueries({ queryKey: ["puzzles"] });
    setCurrentId(nextP?.id ?? "none");
    if (nextP?.id === current.id) {
      setFen(current.fen);
      setResult(null);
    }
  }

  const arrows = result === "failed" ? [{ startSquare: current.best_uci.slice(0, 2), endSquare: current.best_uci.slice(2, 4), color: cssVar("--arrow-best") }] : [];
  const styles: Record<string, React.CSSProperties> = selected ? { [selected]: sq.key } : {};

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,520px)_1fr]">
      <div className="space-y-2">
        <Board
          position={fen}
          boardOrientation={turn === "w" ? "white" : "black"}
          allowDragging={!result && !checking}
          arrows={arrows}
          squareStyles={styles}
          onPieceDrop={({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            const legal = new Chess(current.fen).moves({ square: sourceSquare as Square, verbose: true }).some((m) => m.to === targetSquare);
            if (!legal || result) return false;
            void attempt(sourceSquare, targetSquare);
            return true;
          }}
          onSquareClick={({ square }) => {
            if (result) return;
            const c = new Chess(current.fen);
            if (selected && c.moves({ square: selected, verbose: true }).some((m) => m.to === square)) return void attempt(selected, square);
            const p = c.get(square as Square);
            setSelected(p && p.color === turn ? (square as Square) : null);
          }}
        />
      </div>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">My puzzles</h1>
          <div className="mt-3">{filter}</div>
          <p className="text-sm text-muted-foreground">
            {queue.length} to go · {solved} solved · accuracy {solvedTotal + failedTotal ? Math.round((solvedTotal / (solvedTotal + failedTotal)) * 100) : 0}%
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {current.status === "failed" ? "Retry · " : ""}
            {current.severity === "blunder" ? "Blunder" : "Mistake"} in your game
          </p>
          <p className="mt-1 font-semibold">
            You played <span className="text-blunder">{current.played_san}</span>. Find a better move for {turn === "w" ? "White" : "Black"}.
          </p>
          {checking && <p className="mt-3 text-sm text-muted-foreground">Checking your move…</p>}
          {result && (
            <div className={cn("mt-3 flex items-start gap-2 rounded-lg p-3", result === "solved" ? "bg-secondary" : "bg-muted")}>
              {result === "solved" ? <Check className="h-5 w-5 text-best" /> : <X className="h-5 w-5 text-blunder" />}
              <div className="text-sm">
                {result === "solved" ? "Solved!" : "Not quite."} Best: <span className="font-semibold">{current.best_san}</span>
                {current.best_line && <div className="text-muted-foreground">Line: {current.best_line}</div>}
              </div>
            </div>
          )}
          {result && (
            <Button className="mt-3" onClick={next}>
              Next puzzle
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
