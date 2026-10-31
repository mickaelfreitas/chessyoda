import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, HelpCircle, Loader2 } from "lucide-react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useServerFn } from "@tanstack/react-start";

import { Board } from "@/components/Board";
import { EvalBar } from "@/components/EvalBar";
import { MoveLabelBadge, labelText } from "@/components/MoveLabelBadge";
import { Button } from "@/components/ui/button";
import { gameQuery, profileQuery, cssVar } from "@/lib/queries";
import { capEval, formatEval } from "@/lib/coach";
import { explainMistake } from "@/lib/explain.functions";
import { cn } from "@/lib/utils";
import { CapturedMaterial } from "@/components/CapturedMaterial";
import { materialAt } from "@/lib/game-session";

export const Route = createFileRoute("/_authenticated/review/$gameId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Game review — Chess Yoda" },
      { name: "description", content: "Step through the game with engine evaluations and coach explanations." },
      { property: "og:title", content: "Game review — Chess Yoda" },
      { property: "og:description", content: "Step through the game with engine evaluations and coach explanations." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(gameQuery(params.gameId)),
  component: Review,
});

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function Review() {
  const { gameId } = Route.useParams();
  const { data: game } = useSuspenseQuery(gameQuery(gameId));
  const { data: profile } = useQuery(profileQuery);
  const moves = game.moves;
  const [idx, setIdx] = useState(moves.length); // 0 = start position, i = after move i
  const [why, setWhy] = useState<Record<number, { loading: boolean; text?: string }>>({});
  const explain = useServerFn(explainMistake);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(moves.length, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moves.length]);

  const cur = idx > 0 ? moves[idx - 1] : null;
  const fen = cur?.fenAfter ?? moves[0]?.fenBefore ?? START;
  const orientation = game.player_color === "black" ? "black" : "white";
  const material = useMemo(() => materialAt(game.pgn ?? moves.map((move) => move.san), idx), [game.pgn, moves, idx]);

  const chartData = useMemo(
    () => [{ ply: 0, v: 0.2 }, ...moves.map((m) => ({ ply: m.ply, v: capEval(m.mateAfter !== null ? (m.mateAfter > 0 ? 1000 : -1000) : m.evalAfter) / 100 }))],
    [moves],
  );

  const showBest = cur?.byPlayer && (cur.label === "mistake" || cur.label === "blunder" || cur.label === "inaccuracy") && cur.bestUci;
  const arrows = showBest ? [{ startSquare: cur!.bestUci.slice(0, 2), endSquare: cur!.bestUci.slice(2, 4), color: cssVar("--arrow-best") }] : [];
  const squareStyles: Record<string, React.CSSProperties> = cur
    ? { [cur.uci.slice(0, 2)]: { backgroundColor: "var(--highlight-last)" }, [cur.uci.slice(2, 4)]: { backgroundColor: "var(--highlight-last)" } }
    : {};

  async function askWhy(ply: number) {
    const m = moves[ply - 1]!;
    setWhy((w) => ({ ...w, [ply]: { loading: true } }));
    try {
      const res = await explain({ data: { fen: m.fenBefore, played: m.san, bestLine: m.bestLine.slice(0, 8), rating: profile?.rating ?? 1400 } });
      setWhy((w) => ({ ...w, [ply]: { loading: false, text: res.text ?? res.error ?? "" } }));
    } catch {
      setWhy((w) => ({ ...w, [ply]: { loading: false, text: "The coach couldn't answer right now." } }));
    }
  }

  const keyMoments = moves.filter((m) => m.byPlayer && (m.label === "mistake" || m.label === "blunder"));
  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]] as const);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,520px)_1fr]">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">vs {game.opponent}</h1>
          <span className="font-mono text-sm">{game.result}{!game.rated && " · Unrated"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm"><span>{game.opponent}</span><CapturedMaterial material={material} side={orientation === "white" ? "b" : "w"} /></div>
        <div className="flex gap-2">
          <EvalBar cp={cur?.evalAfter ?? 20} mate={cur?.mateAfter ?? null} orientation={orientation} />
          <div className="min-w-0 flex-1">
            <Board position={fen} boardOrientation={orientation} allowDragging={false} arrows={arrows} squareStyles={squareStyles} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm"><span>{profile?.display_name ?? "You"}</span><CapturedMaterial material={material} side={orientation === "white" ? "w" : "b"} /></div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => setIdx(0)} aria-label="Start"><ChevronsLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={() => setIdx((i) => Math.min(moves.length, i + 1))} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={() => setIdx(moves.length)} aria-label="End"><ChevronsRight className="h-4 w-4" /></Button>
          </div>
          {cur && <span className="font-mono text-sm">{formatEval(cur.evalAfter, cur.mateAfter)}</span>}
        </div>
        {cur?.byPlayer && cur.label && (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <MoveLabelBadge label={cur.label} />
              <span className="font-semibold">{cur.san}</span>
            </div>
            {showBest && (
              <p className="mt-2 text-sm text-muted-foreground">
                Better: <span className="font-semibold text-foreground">{cur.bestLine[0]}</span> — line: {cur.bestLine.join(" ")}
              </p>
            )}
            {(cur.label === "mistake" || cur.label === "blunder") && (
              <div className="mt-3">
                {why[cur.ply]?.text ? (
                  <p className="rounded-lg bg-secondary p-3 text-sm">{why[cur.ply]!.text}</p>
                ) : (
                  <Button size="sm" onClick={() => askWhy(cur.ply)} disabled={why[cur.ply]?.loading}>
                    {why[cur.ply]?.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HelpCircle className="h-4 w-4" />} Why?
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="h-40 rounded-xl border bg-card p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} onClick={(e) => e?.activeLabel !== undefined && setIdx(Number(e.activeLabel))}>
              <XAxis dataKey="ply" hide />
              <YAxis domain={[-10, 10]} hide />
              <ReferenceLine y={0} stroke="var(--border)" />
              {idx > 0 && <ReferenceLine x={idx} stroke="var(--primary)" />}
              <Tooltip formatter={(v: number) => v.toFixed(1)} labelFormatter={(l) => `Ply ${l}`} />
              <Area type="monotone" dataKey="v" stroke="var(--primary)" fill="var(--secondary)" baseValue={-10} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {keyMoments.length > 0 && (
          <div className="rounded-xl border bg-card p-3">
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Key moments</h2>
            <div className="flex flex-wrap gap-2">
              {keyMoments.map((m) => (
                <button key={m.ply} onClick={() => setIdx(m.ply)} className={cn("rounded-md border px-2 py-1 text-sm font-medium", labelText[m.label!], idx === m.ply && "bg-secondary")}>
                  {Math.ceil(m.ply / 2)}{m.color === "w" ? "." : "…"} {m.san}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto rounded-xl border bg-card p-3">
          <ol className="grid grid-cols-[2rem_1fr_1fr] gap-y-1 text-sm">
            {pairs.map(([w, b], i) => (
              <li key={i} className="contents">
                <span className="text-muted-foreground">{i + 1}.</span>
                {[w, b].map((m) =>
                  m ? (
                    <button
                      key={m.ply}
                      onClick={() => setIdx(m.ply)}
                      className={cn("rounded px-1 text-left font-medium", m.label && m.label !== "best" && m.label !== "good" && labelText[m.label], idx === m.ply && "bg-secondary")}
                    >
                      {m.san}
                    </button>
                  ) : (
                    <span key="e" />
                  ),
                )}
              </li>
            ))}
          </ol>
        </div>
        <Button asChild variant="outline"><Link to="/puzzles">Train these mistakes</Link></Button>
      </div>
    </div>
  );
}
