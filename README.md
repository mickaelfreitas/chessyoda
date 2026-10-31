# Chess Yoda

A chess training app for players working toward 1800 Elo: play opponents from
800–2400, use instant rule-based coaching, review mistakes, train personalized
puzzles, import Lichess/Chess.com games, and track progress.

Built with React, TanStack Start, chess.js, react-chessboard, and Lovable Cloud.
Stockfish runs locally in two browser workers; live coaching does not call AI.

## Run locally

Install Bun, clone this repository, then:

```sh
bun install
cp .env.example .env.local
# Fill .env.local privately; never commit it.
bun run dev
```

Use a development backend with email/password auth and apply the checked-in SQL
migrations using your backend's migration tooling. The repository contains no
real private credentials. The Lovable-managed `.env` may remain tracked: before
publishing, remove it from tracking and ensure the ignore rules below are installed.
Ignoring files alone does not remove previously committed copies.

Required ignore rules (the editor currently protects `.gitignore`):

```gitignore
.env
.env.*
**/.env
**/.env.*
!.env.example
.dev.vars
.dev.vars.*
```

## Environment variables

| Variable | Purpose | Visibility |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Public backend URL | Browser |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public anon/publishable key | Browser |
| `VITE_SUPABASE_PROJECT_ID` | Public project identifier | Browser |
| `SUPABASE_URL` | Backend URL for server requests | Server |
| `SUPABASE_PUBLISHABLE_KEY` | Public key for authenticated server queries | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Atomic quota and generated cache writes | Server secret only |
| `ANTHROPIC_API_KEY` | Anthropic mistake explanations | Server secret only |

In production, store private values in encrypted runtime secrets, never in source,
browser variables, or committed environment files. Lovable Cloud supplies its managed
server credentials; they are not manually exported from Cloud.

## Explanation security

The existing `explainMistake` TanStack server function validates JWTs, origin,
FEN, legal SAN moves/continuations, rating 0–3500, and input lengths. There is no
`explain-move` Edge Function in this project. Same-origin RPC needs no cross-origin
CORS grant; origins are restricted to chessyoda.com and the exact Lovable preview
origin, with localhost:8080 permitted only in development.

`DAILY_EXPLANATION_LIMIT` is defined once in `src/lib/explain.functions.ts`.
An atomic, service-only database operation consumes one of 300 requests per UTC
day before cache reads or model calls; cache hits and upstream failures count to
prevent retries from bypassing the cap. Usage is owner-readable and cannot be
changed by clients. Cached generated explanations are signed-in-readable only.

The requested model is `claude-haiku-5-5`, with `max_tokens: 200`. This ID was not
listed in Anthropic's official model documentation during the audit; until it is
available, the API returns a generic error rather than silently substituting a model.

## Tests

```sh
bun run test
```

## License and credits

This repository is licensed under **GPL-3.0**; see [LICENSE](LICENSE).
Stockfish is GPL-3.0 software by the Stockfish developers. The bundled
Stockfish.js 19 lite single-threaded build is from
[nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) (npm `stockfish` 19.0.1).
Corresponding sources and build scripts are available in the upstream
[v19.0.1 source release](https://github.com/nmrugg/stockfish.js/tree/v19.0.1)
and [official Stockfish](https://github.com/official-stockfish/Stockfish).
Redistributors must preserve notices and provide corresponding source in accordance
with GPL-3.0; an upstream link alone may not fulfill every redistribution scenario.
chess.js and react-chessboard retain their respective upstream licenses.

## Vulnerability reports

Report privately by email as described in [SECURITY.md](SECURITY.md), not public issues.
