import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Board } from "@/components/Board";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chess Yoda — train from 1400 to 1800" },
      { name: "description", content: "Play a tunable engine, get instant coaching, and turn your mistakes into puzzles." },
      { property: "og:title", content: "Chess Yoda — train from 1400 to 1800" },
      { property: "og:description", content: "Play a tunable engine, get instant coaching, and turn your mistakes into puzzles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  ["Safety net", "Catches blunders before they cost you the game."],
  ["Threat check", "Asks what your opponent wants after every move."],
  ["Your puzzles", "Every mistake you make becomes training material."],
];

function Index() {
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-5 py-10 md:grid-cols-2">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Chess Yoda</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
          Fewer blunders. <br />
          Calmer chess.
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          A patient training partner for players climbing from 1400 to 1800 — play the engine, review with an AI coach, drill your own mistakes.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild size="lg">
            <Link to="/play">Start training</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
        <ul className="mt-8 space-y-3">
          {features.map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
              <span>
                <span className="font-semibold">{t}.</span> <span className="text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-auto w-full max-w-md">
        <Board position="r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4" allowDragging={false} />
      </div>
    </main>
  );
}
