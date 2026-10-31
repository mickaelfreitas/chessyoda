import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import ParticleKing from "@/components/ParticleKing";

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
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col justify-center gap-5 px-5 py-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Chess Yoda</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
          Fewer blunders. <br />
          Calmer chess.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          A patient training partner for players climbing from 1400 to 1800 — play the engine, review with an AI coach, drill your own mistakes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/play">Start training</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
      <div className="hero-orbs" aria-label="Chess king and Yoda particle orbs">
        <div><ParticleKing /></div>
        <iframe src="/particle-yoda.html" title="Yoda-shaped green particle orb" />
      </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {features.map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
              <span>
                <span className="font-semibold">{t}.</span> <span className="text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ul>
    </main>
  );
}
