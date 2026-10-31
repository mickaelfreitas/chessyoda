import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { gamesQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/review/")({
  head: () => ({
    meta: [
      { title: "Game review — Chess Yoda" },
      { name: "description", content: "Replay your games and see where they turned." },
      { property: "og:title", content: "Game review — Chess Yoda" },
      { property: "og:description", content: "Replay your games and see where they turned." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(gamesQuery),
  component: ReviewList,
});

function ReviewList() {
  const { data: games } = useSuspenseQuery(gamesQuery);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">Your games</h1>
      {games.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="text-muted-foreground">No games yet.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button asChild><Link to="/play">Play a game</Link></Button>
            <Button asChild variant="outline"><Link to="/import">Import games</Link></Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {games.map((g) => (
            <li key={g.id}>
              <Link to="/review/$gameId" params={{ gameId: g.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/60">
                <div className="min-w-0">
                  <div className="truncate font-semibold">vs {g.opponent ?? "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(g.created_at), "MMM d, yyyy")} · {g.source === "play" ? "Chess Yoda" : g.source === "lichess" ? "Lichess" : "Chess.com"} · as {g.player_color}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <span className="text-blunder">{g.blunders}B</span>
                  <span className="text-mistake">{g.mistakes}M</span>
                  <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs">{g.result ?? "*"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
