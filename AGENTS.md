<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

> [!IMPORTANT]
> This repository is connected to a two-way editing workflow. Avoid rewriting
> published Git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — because this can replace saved project history.
>
> Commits pushed to the connected branch sync back to the editor, so keep the
> branch in a working state.

## Architecture rules
- Keep platform metadata, generated authentication protocols, deployment configuration and external diagnostic hooks intact; use neutral names for application-owned wrappers so repository cleanup does not break the connected workflow.
- Stockfish runs client-side from `public/stockfish/` (lite single-threaded WASM) via `src/lib/engine.ts`; scores are normalized to White's POV — keeps it free of cross-origin-isolation headers and server cost.
- Live coaching (labels, safety net, threats, hints) is pure rule code in `src/lib/coach.ts` from engine data, never AI — keeps play instant; covered by `src/test/coach.test.ts`.
- AI mistake explanations run in a `createServerFn` (`src/lib/explain.functions.ts`) behind `requireSupabaseAuth`, not a Supabase Edge Function — TanStack Start convention.
- Puzzles are created when a game is saved (`saveGame` in `src/lib/data.ts`) from the player's mistake/blunder MoveRecords — single source for played and imported games.
- Signed-in pages live under `src/routes/_authenticated/`, whose layout also renders the app nav.
- Landing particle visuals use the supplied ParticleKing component and an isolated Yoda canvas document; keep animation initialization in client-only effects to avoid SSR browser API access.
- Shared application tokens and typography reuse the landing palette for training, account screens, and portaled controls; keep landing layouts scoped to `.landing` and board-square tokens independent for readable playing boards. The landing demonstration board uses chess.js positions with local presentation-only coach state.
- The explanation allowance is configured once in the authenticated server-function module and consumed atomically through a service-only database RPC; clients have read-only access to their usage and the shared generated cache to prevent quota tampering and cache poisoning.
- Explanation inputs and exact allowed origins are validated before privileged work; Anthropic secrets are read inside the authenticated handler only; failures log only fixed step/field names via explain-diagnostics, and status/reason details reach the UI only in dev builds — prevents sensitive logging and production leakage.
- Game snapshots are serialized through a per-session save queue into the existing owner-scoped games table; replay PGN on resume to preserve repetition, and finalize the same row to avoid duplicate games/puzzles.
- Rated eligibility is derived from take-back and hint usage in both pure client rules and a database trigger; forecasting uses completed rated engine games only, Glicko-2 from the established library and a browser worker for the Bayesian grid to keep interaction responsive.
- Landing forecast and skills demos are isolated from real progress data; initialize their supplied DOM animations in a client effect and clean up observers, listeners, timers and frames on navigation.
- Account password fields share PasswordInput with a local, concealed-by-default visibility toggle; keep visibility separate from authentication and never persist or log entered passwords.
- AI coaching receives replayed-line chess.js material outcomes and verbal severity rather than raw positions or numeric evaluations; Why output is capped server-side at three sentences and cache versions change with the facts contract. Reply continuations are stored with move records and older rows are enriched through an owner-scoped atomic JSON merge to avoid overwriting concurrent skill evidence.
- Game learnings use an authenticated owner read followed by a service-only atomic claim in game_learnings; completed generations are immutable to clients and separate from the Why quota to prevent duplicate billing or quota interference.
- Post-game skill evidence is computed with the browser coach worker and saved in owner-scoped move records; radar posteriors use jStat Beta quantiles and never mix landing sample data into real progress.
