import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ParticleKing from "@/components/ParticleKing";
import { LandingBoard } from "@/components/LandingBoard";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Chess Yoda — improve your chess force" },
    { name: "description", content: "Train with an engine from 800 to 2400 Elo, catch blunders, and turn your mistakes into tomorrow’s puzzles." },
    { property: "og:title", content: "Chess Yoda — improve your chess force" },
    { property: "og:description", content: "Play at your level, review your games, and train your own mistakes with Chess Yoda." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Index,
});

const modes = {
  off: ["Coach off", "Just you and the board. Review the game afterwards if you want."],
  safety: ["Safety net", "Quiet until it matters. Blunder, and you get one chance to take it back."],
  full: ["Threat check", "White’s last move created a threat. What is it, and how do you stop it?"],
};
const samples = [
  ["Hanging knight on d4", "Your game vs engine 1600, move 14", "Missed twice"],
  ["Back-rank mate threat", "Imported from Lichess, move 27", "New"],
  ["Fork on c7", "Your game vs engine 1500, move 9", "New"],
  ["Pawn endgame opposition", "Imported from Chess.com, move 48", "Solved"],
];

function Index() {
  const [mode, setMode] = useState<keyof typeof modes>("full");
  const [revealed, setRevealed] = useState(false);
  return <div className="landing">
    <header className="landing-header landing-wrap">
      <Link to="/" className="landing-wordmark">chessyoda.com</Link>
      <nav className="landing-nav" aria-label="Main"><a href="#coach">How it works</a><a href="#puzzles">Puzzles</a></nav>
      <div className="landing-nav-actions"><Button asChild variant="outline" className="landing-button landing-signin"><Link to="/auth">Sign in</Link></Button><Button asChild className="landing-button"><Link to="/play">Start a game</Link></Button></div>
    </header>
    <main>
      <section className="landing-hero">
        <div className="landing-wrap landing-hero-inner">
          <div className="landing-hero-text">
            <iframe className="landing-yoda" src="/particle-yoda.html" title="Yoda-shaped green particle orb" />
            <h1>Improve your<br />chess <span className="landing-force">force.</span></h1>
            <p className="landing-lead">A training partner that plays at your level, from 800 to 2400, catches blunders the moment you make them, and turns every mistake into tomorrow’s puzzle.</p>
            <div className="landing-button-row"><Button asChild className="landing-button"><Link to="/play">Start a game</Link></Button><Button asChild variant="outline" className="landing-button"><a href="#coach">How the coach works</a></Button></div>
          </div>
          <div className="landing-king">
            <ParticleKing />
          </div>
        </div>
      </section>
      <section className="landing-section" id="play">
        <div className="landing-wrap landing-columns">
          <div className="landing-stack"><h2>You play.<br />The coach watches.</h2><p className="landing-body">Pick an engine opponent from 800 to 2400 and choose how much help you want. Switch modes below to see what changes on the board.</p>
            <div className="landing-modes" role="group" aria-label="Coach mode">{(["off", "safety", "full"] as const).map((value) => <Button key={value} variant="ghost" aria-pressed={mode === value} onClick={() => { setMode(value); setRevealed(false); }}>{value === "off" ? "Off" : value === "safety" ? "Safety net" : "Full coach"}</Button>)}</div>
            <div className="landing-coach" aria-live="polite"><span className="landing-label">{modes[mode][0]}</span><p>{mode === "full" && revealed ? "The queen on h5 and bishop on c4 both attack f7. Protect that square and your king." : modes[mode][1]}</p>{mode === "full" && <div className="landing-button-row"><Button variant="outline" className="landing-button landing-small" onClick={() => setRevealed(true)}>Show me</Button><Button variant="outline" className="landing-button landing-small" onClick={() => setRevealed(false)}>I see it</Button></div>}</div>
          </div>
          <LandingBoard highlighted={mode === "full"} />
        </div>
      </section>
      <section className="landing-section" id="coach"><div className="landing-wrap landing-stack landing-hints"><div className="landing-stack"><h2>Hints that make you think</h2><p className="landing-body">Each tap on Hint reveals a little more. Most of the learning happens before the third one.</p></div><div className="landing-ladder">{[
        ["1", "Nudge", "“Something is aimed at your king.” You still have to find it."],
        ["2", "Point", "The key square lights up. Here it is f7, hit by the queen and the bishop."],
        ["3", "Reveal", "An arrow shows the engine’s move, g6, and a short explanation of why it works."],
      ].map(([n, title, text]) => <div className="landing-step" key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></div>)}</div></div></section>
      <section className="landing-section" id="puzzles"><div className="landing-wrap landing-columns"><div className="landing-stack"><h2>Lose on Tuesday.<br />Train the fix on Wednesday.</h2><p className="landing-body">Every mistake from your games, played here or imported from Lichess and Chess.com, comes back as a puzzle. Miss it, and it returns until you don’t.</p><Button asChild variant="outline" className="landing-button landing-self-start"><Link to="/import">Import my games<ArrowUpRight aria-hidden="true" /></Link></Button></div><div className="landing-queue"><div className="landing-queue-head"><span>Today’s queue</span><span>Sample</span></div>{samples.map(([title, source, status]) => <div className="landing-queue-row" key={title}><div><span className="landing-queue-title">{title}</span><span className="landing-queue-source">{source}</span></div><span className={`landing-badge ${status === "Solved" ? "is-solved" : status === "Missed twice" ? "is-missed" : ""}`}>{status}</span></div>)}</div></div></section>
      <section className="landing-section landing-cta"><div className="landing-wrap landing-stack"><h2>The board is set</h2><p className="landing-lead">Free to play. Your games, puzzles and progress are saved to your account.</p><Button asChild className="landing-button landing-self-start"><Link to="/play">Start a game</Link></Button></div></section>
    </main>
    <footer className="landing-footer"><div className="landing-wrap"><span>© 2026 chessyoda.com</span></div></footer>
  </div>;
}
