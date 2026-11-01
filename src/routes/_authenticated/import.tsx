import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Engine } from "@/lib/engine";
import { analyzePgn } from "@/lib/analyze";
import { existingExternalIds, saveGame } from "@/lib/data";
import { fetchChessCom, fetchLichess } from "@/lib/importers";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { generateLearnings } from "@/lib/learnings.functions";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Import games — Chess Yoda" },
      { name: "description", content: "Pull your recent Lichess or Chess.com games and turn mistakes into puzzles." },
      { property: "og:title", content: "Import games — Chess Yoda" },
      { property: "og:description", content: "Pull your recent Lichess or Chess.com games and turn mistakes into puzzles." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const learn = useServerFn(generateLearnings);
  const [site, setSite] = useState<"lichess" | "chesscom">("lichess");
  const [username, setUsername] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{ games: number; puzzles: number; skipped: number } | null>(null);
  const cancel = useRef(false);
  const queryClient = useQueryClient();

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setRunning(true);
    setSummary(null);
    cancel.current = false;
    const engine = new Engine();
    try {
      setStatus("Fetching games…");
      const games = site === "lichess" ? await fetchLichess(username.trim()) : await fetchChessCom(username.trim());
      const seen = await existingExternalIds(site);
      const todo = games.filter((g) => !seen.has(g.id));
      let puzzles = 0;
      let done = 0;
      for (let i = 0; i < todo.length; i++) {
        if (cancel.current) break;
        const g = todo[i];
        if (!g) continue;
        setStatus(`Analyzing game ${i + 1} of ${todo.length} (vs ${g.opponent})`);
        setProgress((i / Math.max(1, todo.length)) * 100);
        const moves = await analyzePgn(engine, g.pgn, g.playerColor === "white" ? "w" : "b", 100);
        puzzles += moves.filter((m) => m.byPlayer && (m.label === "mistake" || m.label === "blunder")).length;
        const gameId = await saveGame({
          source: site,
          externalId: g.id,
          playerColor: g.playerColor,
          opponent: g.opponent,
          opponentElo: g.opponentElo,
          coachMode: "off",
          timeControl: g.timeControl,
          result: g.result,
          pgn: g.pgn,
          moves,
          takebacks: 0,
          createdAt: g.createdAt,
        });
        await learn({ data: { gameId } });
        done++;
      }
      setProgress(100);
      setSummary({ games: done, puzzles, skipped: games.length - todo.length });
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      engine.terminate();
      setRunning(false);
      setStatus("");
    }
  }

  const opt = (a: boolean) => cn("rounded-lg border px-3 py-2 text-sm font-medium", a ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary");

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Import games</h1>
        <p className="text-muted-foreground">We'll analyze your last 20 games and add your mistakes to My Puzzles.</p>
      </div>
      <form onSubmit={run} className="space-y-4 rounded-xl border bg-card p-5">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={opt(site === "lichess")} onClick={() => setSite("lichess")}>Lichess</button>
          <button type="button" className={opt(site === "chesscom")} onClick={() => setSite("chesscom")}>Chess.com</button>
        </div>
        <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={running} />
        {running ? (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {status}</p>
            <Button type="button" variant="outline" onClick={() => (cancel.current = true)}>Stop after this game</Button>
          </div>
        ) : (
          <Button type="submit" className="w-full">Fetch & analyze</Button>
        )}
      </form>
      {summary && (
        <div className="rounded-xl border bg-card p-5">
          <p className="font-semibold">
            Analyzed {summary.games} game{summary.games === 1 ? "" : "s"}, found {summary.puzzles} new puzzle{summary.puzzles === 1 ? "" : "s"}.
          </p>
          {summary.skipped > 0 && <p className="text-sm text-muted-foreground">{summary.skipped} already imported were skipped.</p>}
          <div className="mt-3 flex gap-2">
            <Button asChild><Link to="/puzzles">Solve puzzles</Link></Button>
            <Button asChild variant="outline"><Link to="/review">See games</Link></Button>
          </div>
        </div>
      )}
    </div>
  );
}
