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

## Architecture rules
- Stockfish runs client-side from `public/stockfish/` (lite single-threaded WASM) via `src/lib/engine.ts`; scores are normalized to White's POV — keeps it free of cross-origin-isolation headers and server cost.
- Live coaching (labels, safety net, threats, hints) is pure rule code in `src/lib/coach.ts` from engine data, never AI — keeps play instant; covered by `src/test/coach.test.ts`.
- AI mistake explanations run in a `createServerFn` (`src/lib/explain.functions.ts`) behind `requireSupabaseAuth`, not a Supabase Edge Function — TanStack Start convention.
- Puzzles are created when a game is saved (`saveGame` in `src/lib/data.ts`) from the player's mistake/blunder MoveRecords — single source for played and imported games.
- Signed-in pages live under `src/routes/_authenticated/`, whose layout also renders the app nav.
- Landing particle visuals use the supplied ParticleLineup component and an isolated Yoda canvas document; keep animation initialization in client-only effects to avoid SSR browser API access.
- Landing styles and theme variables are scoped to `.landing` so presentation changes do not alter training pages; its demonstration board uses chess.js positions with local presentation-only coach state.
- The explanation allowance is configured once in the authenticated server-function module and consumed atomically through a service-only database RPC; clients have read-only access to their usage and the shared generated cache to prevent quota tampering and cache poisoning.
- Explanation inputs and exact allowed origins are validated before privileged work; Anthropic secrets are read inside the authenticated handler only, and diagnostics use fixed messages rather than raw errors to prevent sensitive logging.
