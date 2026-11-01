# Chess Yoda

**An AI chess coach that teaches you *why* you keep missing moves, not just what the best move was.**

[chessyoda.com](https://chessyoda.com)

![Chess Yoda](docs/hero.gif)

## Why I built it

I wanted to self improve faster in chess. Existing tools show you the engine’s best move after the game, but none of them explains why you keep missing it, spots the patterns in your mistakes, digs through your game history to find your weaknesses, builds puzzles tailored to you, and forecasts your progress. So I built the coach I wanted.

## Features

- **Play Stockfish at your level:** 800 to 2400 Elo, with a coach you can switch on or off.
- **Live coaching:** threat checks after every opponent move, blunder warnings with optional take-backs, and progressive hints (nudge → point → reveal).
- **"Why?" explanations:** every warning comes with a short, level-appropriate explanation.
- **Your mistakes become your training:** every mistake from your games, played here or imported from Lichess and Chess.com, becomes a personal puzzle until you solve it.
- **Key learnings** after every game, saved and searchable.
- **Bayesian progress forecast** with an honest uncertainty band.
- **Skills radar** across six areas: opening play, tactics, positional play, endgames, defense and consistency.

## How it works

**The engine decides, the AI explains.** LLMs are unreliable at chess, so all chess judgment comes from Stockfish, running in the browser via WebAssembly. Material outcomes and severity are computed in code. The language model (Claude Haiku 5.5) only turns those verified facts into a short explanation, and it never analyzes positions itself.

**Bayesian forecasting.** Current rating is estimated with Glicko-2 from rated games (no take-backs, no hints). A small Bayesian trend model (rating = r₀ + slope × t, Elo likelihood, grid-approximated posterior) forecasts the next 8 weeks as an 80% credible band and gives the probability that you're actually improving.

**Skills radar.** Each axis is a success rate with a Beta posterior, updated from engine-tagged positions in your games and puzzles, weighted toward recent games. Axes with too little evidence say so instead of guessing.

## Tech stack

React + TypeScript · Supabase (Postgres with row-level security, auth, server functions) · Stockfish (WASM) · chess.js · Claude Haiku 5.5 · built with [Lovable](https://lovable.dev)

## Run locally

```bash
git clone https://github.com/[your-username]/chessyoda.git
cd chessyoda
cp .env.example .env   # add your Supabase URL and anon key
npm install
npm run dev
```

The explanation function needs an `ANTHROPIC_API_KEY` secret in your Supabase project.
