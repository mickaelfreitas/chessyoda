# Chess Yoda Coach

Build a chess training web app called "Chess Yoda" in React, designed to help a player improve from ~1400 to 1800 Elo. Clean, minimal, mobile-friendly design.

CORE ENGINE
- Use chess.js for rules and react-chessboard for the board.
- Run two Stockfish instances (stockfish.js WASM) in separate web workers:
  1. "Opponent" engine with a difficulty slider mapped to approximate Elo (800–2200) using Stockfish skill level and depth limits.
  2. "Coach" engine at full strength that analyzes every position in the background.

PAGE 1 — PLAY
- Play against the opponent as white or black. Time control options: 10+0, 15+10, 30+0, and no clock.
- Evaluation bar beside the board (can be hidden), move list below.
- "Coach mode" selector with 3 options:
  • Off: normal game, no help.
  • Safety net: after the player moves, if the coach evaluation drops by more than 2 pawns, show "This move loses material" with Take back / Keep move buttons. Count take-backs and show the count at the end of the game.
  • Full coach: includes Safety net, plus:
    - After each bot move, first ask the player "What is your opponent threatening?" with a "Show me" button that reveals the threat (highlight attacked pieces).
    - A "Hint" button with 3 progressive levels: (1) a general nudge like "There's a tactic available" or "A piece is undefended", (2) highlight the key piece or square, (3) show the best move as an arrow.
    - After each player move, show a quick label: Best / Good / Inaccuracy / Mistake / Blunder, based on evaluation change.
- Live tips must be generated instantly from engine data using rules (no AI call) to keep the game fast.

PAGE 2 — GAME REVIEW
- After each game, open a review screen: replay moves, evaluation graph, mistakes and blunders highlighted.
- For each mistake, a "Why?" button calls an AI explanation through a Supabase edge function. Prompt for the AI: "Here is the position (FEN), the move played, and Stockfish's best line. Explain the mistake to a [player rating]-level player in 2–3 sentences. Only refer to moves in the engine line; never invent moves."

PAGE 3 — MY PUZZLES
- Every mistake or blunder from the player's games becomes a puzzle: show the position before the mistake and ask the player to find the better move.
- Track solved/failed puzzles; repeat failed ones until solved.

PAGE 4 — IMPORT GAMES
- Enter a Lichess or Chess.com username, fetch the last 20 games via their public APIs, analyze them with the coach engine, and add their mistakes to My Puzzles.

PAGE 5 — PROGRESS
- Store games, puzzles, and stats in Supabase with user accounts.
- Show: games played, blunders per game over time, take-back count trend, puzzle accuracy, and most common mistake types (hanging pieces, missed tactics, endgame errors).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://chess-yoda-coach.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/148f2dc3-6131-4c13-b3db-09bd09d28f7d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
