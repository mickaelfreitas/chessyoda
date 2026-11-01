export type ExternalGame = {
  source: "lichess" | "chesscom";
  id: string;
  pgn: string;
  playerColor: "white" | "black";
  opponent: string;
  opponentElo: number | null;
  result: string;
  timeControl: string | null;
  createdAt: string;
};

export async function fetchLichess(username: string, max = 20): Promise<ExternalGame[]> {
  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=true&clocks=false&evals=false&opening=true`, {
    headers: { Accept: "application/x-ndjson" },
  });
  if (res.status === 404) throw new Error("Lichess user not found");
  if (!res.ok) throw new Error("Lichess request failed");
  const text = await res.text();
  const u = username.toLowerCase();
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((g) => g.variant === "standard" && g.pgn)
    .map((g) => {
      const white = g.players?.white?.user?.name ?? "?";
      const black = g.players?.black?.user?.name ?? "?";
      const isWhite = white.toLowerCase() === u;
      const opp = isWhite ? g.players?.black : g.players?.white;
      const result = g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "1/2-1/2";
      return {
        source: "lichess" as const,
        id: g.id,
        pgn: g.opening?.name && !g.pgn.includes('[Opening "') ? `[Opening "${String(g.opening.name).replace(/["\\\n\r]/g, "")}"]\n${g.pgn}` : g.pgn,
        playerColor: isWhite ? ("white" as const) : ("black" as const),
        opponent: isWhite ? black : white,
        opponentElo: opp?.rating ?? null,
        result,
        timeControl: g.clock ? `${g.clock.initial / 60}+${g.clock.increment}` : g.speed ?? null,
        createdAt: new Date(g.createdAt).toISOString(),
      };
    });
}

export async function fetchChessCom(username: string, max = 20): Promise<ExternalGame[]> {
  const u = username.toLowerCase();
  const arch = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`);
  if (arch.status === 404) throw new Error("Chess.com user not found");
  if (!arch.ok) throw new Error("Chess.com request failed");
  const { archives } = (await arch.json()) as { archives: string[] };
  const out: ExternalGame[] = [];
  for (const url of [...archives].reverse()) {
    if (out.length >= max) break;
    const r = await fetch(url);
    if (!r.ok) continue;
    const { games } = (await r.json()) as { games: any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const g of [...games].reverse()) {
      if (out.length >= max) break;
      if (g.rules !== "chess" || !g.pgn) continue;
      const isWhite = g.white.username.toLowerCase() === u;
      const me = isWhite ? g.white : g.black;
      const opp = isWhite ? g.black : g.white;
      const result = me.result === "win" ? (isWhite ? "1-0" : "0-1") : opp.result === "win" ? (isWhite ? "0-1" : "1-0") : "1/2-1/2";
      out.push({
        source: "chesscom",
        id: g.uuid ?? g.url,
        pgn: g.pgn,
        playerColor: isWhite ? "white" : "black",
        opponent: opp.username,
        opponentElo: opp.rating ?? null,
        result,
        timeControl: g.time_control ?? null,
        createdAt: new Date(g.end_time * 1000).toISOString(),
      });
    }
  }
  return out;
}
