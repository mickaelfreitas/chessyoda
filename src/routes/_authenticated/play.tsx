import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Eye, Flag, RotateCcw, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Board, sq } from "@/components/Board";
import { EvalBar } from "@/components/EvalBar";
import { MoveLabelBadge, labelText } from "@/components/MoveLabelBadge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Engine, eloToEngineSettings, type Analysis } from "@/lib/engine";
import { buildHint, describeThreat, evalLoss, nullMoveFen, SAFETY_NET_THRESHOLD, LABEL_TEXT, type Hint, type MoveLabel, type Threat } from "@/lib/coach";
import { buildRecord } from "@/lib/analyze";
import { saveGame } from "@/lib/data";
import { cssVar, profileQuery } from "@/lib/queries";
import type { MoveRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/play")({
  head: () => ({
    meta: [
      { title: "Play — Chess Yoda" },
      { name: "description", content: "Play the engine with an optional safety net and live coaching." },
      { property: "og:title", content: "Play — Chess Yoda" },
      { property: "og:description", content: "Play the engine with an optional safety net and live coaching." },
    ],
  }),
  component: PlayPage,
});

type CoachMode = "off" | "safety" | "full";
const TIME_CONTROLS = [
  { id: "10+0", label: "10+0", base: 600, inc: 0 },
  { id: "15+10", label: "15+10", base: 900, inc: 10 },
  { id: "30+0", label: "30+0", base: 1800, inc: 0 },
  { id: "none", label: "No clock", base: 0, inc: 0 },
] as const;
const COACH_MODES: { id: CoachMode; label: string; desc: string }[] = [
  { id: "off", label: "Off", desc: "Normal game, no help." },
  { id: "safety", label: "Safety net", desc: "Warns you before a move loses material." },
  { id: "full", label: "Full coach", desc: "Safety net, threat check, hints and move labels." },
];

type Settings = { color: "w" | "b"; tc: (typeof TIME_CONTROLS)[number]; elo: number; coach: CoachMode };
type Over = { result: string; reason: string };

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function PlayPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gameKey, setGameKey] = useState(0);
  if (!settings) return <Setup onStart={(s) => { setSettings(s); setGameKey((k) => k + 1); }} />;
  return <Game key={gameKey} settings={settings} onNew={() => setSettings(null)} />;
}

function Setup({ onStart }: { onStart: (s: Settings) => void }) {
  const [color, setColor] = useState<"w" | "b" | "r">("w");
  const [tc, setTc] = useState<(typeof TIME_CONTROLS)[number]>(TIME_CONTROLS[3]);
  const [elo, setElo] = useState(1500);
  const [coach, setCoach] = useState<CoachMode>("full");
  const opt = (active: boolean) =>
    cn("rounded-lg border px-3 py-2 text-sm font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary");
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New game</h1>
        <p className="text-muted-foreground">Set up your training opponent.</p>
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Play as</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["w", "b", "r"] as const).map((c) => (
            <button key={c} className={opt(color === c)} onClick={() => setColor(c)}>
              {c === "w" ? "White" : c === "b" ? "Black" : "Random"}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Time control</h2>
        <div className="grid grid-cols-4 gap-2">
          {TIME_CONTROLS.map((t) => (
            <button key={t.id} className={opt(tc.id === t.id)} onClick={() => setTc(t)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Opponent strength</h2>
          <span className="font-display text-2xl font-bold">~{elo}</span>
        </div>
        <Slider min={800} max={2200} step={50} value={[elo]} onValueChange={([v]) => setElo(v)} />
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Coach mode</h2>
        <div className="space-y-2">
          {COACH_MODES.map((m) => (
            <button key={m.id} onClick={() => setCoach(m.id)} className={cn(opt(coach === m.id), "block w-full text-left")}>
              <div>{m.label}</div>
              <div className={cn("text-xs font-normal", coach === m.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{m.desc}</div>
            </button>
          ))}
        </div>
      </section>
      <Button size="lg" className="w-full" onClick={() => onStart({ color: color === "r" ? (Math.random() < 0.5 ? "w" : "b") : color, tc, elo, coach })}>
        Start game
      </Button>
    </div>
  );
}

function Game({ settings, onNew }: { settings: Settings; onNew: () => void }) {
  const { color: player, tc, elo, coach } = settings;
  const bot = player === "w" ? "b" : "w";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQuery);

  const chessRef = useRef(new Chess());
  const coachRef = useRef<Engine | null>(null);
  const oppRef = useRef<Engine | null>(null);
  const cache = useRef(new Map<string, Promise<Analysis>>());
  const recordsRef = useRef<MoveRecord[]>([]);
  const overRef = useRef<Over | null>(null);

  const [fen, setFen] = useState(chessRef.current.fen());
  const [records, setRecords] = useState<MoveRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ rec: MoveRecord; move: Move } | null>(null);
  const [takebacks, setTakebacks] = useState(0);
  const takebacksRef = useRef(0);
  const [lastLabel, setLastLabel] = useState<{ label: MoveLabel; san: string } | null>(null);
  const [threat, setThreat] = useState<{ t: Threat; revealed: boolean } | null>(null);
  const [hint, setHint] = useState<{ h: Hint; level: number } | null>(null);
  const [showEval, setShowEval] = useState(true);
  const [evalNow, setEvalNow] = useState<{ cp: number; mate: number | null }>({ cp: 20, mate: null });
  const [over, setOver] = useState<Over | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [clock, setClock] = useState({ w: tc.base * 1000, b: tc.base * 1000 });
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const analyze = useCallback((f: string) => {
    let p = cache.current.get(f);
    if (!p) {
      p = coachRef.current!.analyze(f, { depth: 12, multipv: 2 });
      cache.current.set(f, p);
    }
    return p;
  }, []);

  const finish = useCallback(
    async (o: Over) => {
      if (overRef.current) return;
      overRef.current = o;
      setOver(o);
      setBusy(false);
      try {
        const id = await saveGame({
          source: "play",
          playerColor: player === "w" ? "white" : "black",
          opponent: `Stockfish ~${elo}`,
          opponentElo: elo,
          coachMode: coach,
          timeControl: tc.id,
          result: o.result,
          pgn: chessRef.current.pgn(),
          moves: recordsRef.current,
          takebacks: takebacksRef.current,
        });
        setSavedId(id);
        queryClient.invalidateQueries();
      } catch (e) {
        toast.error("Couldn't save the game: " + (e instanceof Error ? e.message : ""));
      }
    },
    [player, elo, coach, tc.id, queryClient],
  );

  const checkOver = useCallback(() => {
    const c = chessRef.current;
    if (!c.isGameOver()) return false;
    if (c.isCheckmate()) {
      const winner = c.turn() === "w" ? "b" : "w";
      void finish({ result: winner === "w" ? "1-0" : "0-1", reason: winner === player ? "You won by checkmate" : "Checkmated" });
    } else {
      void finish({ result: "1/2-1/2", reason: c.isStalemate() ? "Stalemate" : c.isThreefoldRepetition() ? "Draw by repetition" : "Draw" });
    }
    return true;
  }, [finish, player]);

  const pushRecord = (rec: MoveRecord) => {
    recordsRef.current = [...recordsRef.current, rec];
    setRecords(recordsRef.current);
    setEvalNow({ cp: rec.evalAfter, mate: rec.mateAfter });
  };

  const addIncrement = (side: "w" | "b") => {
    if (tc.base && tc.inc) setClock((c) => ({ ...c, [side]: c[side] + tc.inc * 1000 }));
  };

  const botMove = useCallback(async () => {
    const c = chessRef.current;
    setBusy(true);
    const s = eloToEngineSettings(elo);
    const opp = oppRef.current!;
    opp.setOption("Skill Level", s.skill);
    const start = Date.now();
    const fenBefore = c.fen();
    const res = await opp.analyze(fenBefore, { depth: s.depth, movetime: s.movetime });
    const wait = 450 - (Date.now() - start);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (overRef.current) return;
    const uci = res.bestmove;
    const move = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
    setFen(c.fen());
    addIncrement(bot);
    const [before, after] = await Promise.all([analyze(fenBefore), analyze(c.fen())]);
    pushRecord(
      buildRecord({ ply: recordsRef.current.length + 1, fenBefore, fenAfter: c.fen(), san: move.san, uci, color: bot, before, after, byPlayer: false }),
    );
    if (checkOver()) return;
    if (coach === "full") {
      const nf = nullMoveFen(c.fen());
      let tMove: string | null = null;
      let gain = 0;
      if (nf) {
        const ta = await coachRef.current!.analyze(nf, { depth: 10 });
        tMove = ta.bestmove || null;
        const sign = bot === "w" ? 1 : -1;
        gain = ((ta.lines[0]?.cp ?? 0) - (after.lines[0]?.cp ?? 0)) * sign;
      }
      setThreat({ t: describeThreat(c.fen(), player, tMove, gain), revealed: false });
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elo, bot, player, coach, analyze, checkOver]);

  const commitPlayer = useCallback(
    (rec: MoveRecord) => {
      pushRecord(rec);
      if (coach === "full" && rec.label) setLastLabel({ label: rec.label, san: rec.san });
      addIncrement(player);
      if (checkOver()) return;
      void botMove();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coach, player, checkOver, botMove],
  );

  // Engines lifecycle
  useEffect(() => {
    coachRef.current = new Engine();
    oppRef.current = new Engine();
    void analyze(chessRef.current.fen());
    if (player === "b") void botMove();
    return () => {
      coachRef.current?.terminate();
      oppRef.current?.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clock
  useEffect(() => {
    if (!tc.base || over) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      if (chessRef.current.history().length === 0 && player === "w") return; // clock starts after first move
      const side = chessRef.current.turn();
      const next = clockRef.current[side] - dt;
      setClock((c) => ({ ...c, [side]: next }));
      if (next <= 0) {
        void finish({ result: side === "w" ? "0-1" : "1-0", reason: side === player ? "You lost on time" : "Opponent flagged" });
      }
    }, 200);
    return () => clearInterval(id);
  }, [tc.base, over, player, finish]);

  async function playerMove(from: string, to: string): Promise<boolean> {
    const c = chessRef.current;
    if (busy || pending || over || c.turn() !== player) return false;
    let move: Move;
    try {
      move = c.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    setFen(c.fen());
    setSelected(null);
    setThreat(null);
    setHint(null);
    setLastLabel(null);
    setBusy(true);
    const [before, after] = await Promise.all([analyze(move.before), analyze(move.after)]);
    if (overRef.current) return true;
    const rec = buildRecord({
      ply: recordsRef.current.length + 1,
      fenBefore: move.before,
      fenAfter: move.after,
      san: move.san,
      uci: move.from + move.to + (move.promotion ?? ""),
      color: player,
      before,
      after,
      byPlayer: true,
    });
    const loss = evalLoss(rec.evalBefore, rec.evalAfter, player);
    if (coach !== "off" && loss > SAFETY_NET_THRESHOLD && !c.isCheckmate()) {
      setPending({ rec, move });
      return true;
    }
    commitPlayer(rec);
    return true;
  }

  function takeBack() {
    chessRef.current.undo();
    setFen(chessRef.current.fen());
    takebacksRef.current += 1;
    setTakebacks(takebacksRef.current);
    setPending(null);
    setBusy(false);
  }
  function keepMove() {
    const p = pending!;
    setPending(null);
    commitPlayer(p.rec);
  }

  async function nextHint() {
    if (hint) return setHint({ ...hint, level: Math.min(3, hint.level + 1) });
    const a = await analyze(chessRef.current.fen());
    const h = buildHint(chessRef.current.fen(), player, a.bestmove, a.lines);
    if (h) setHint({ h, level: 1 });
  }

  function onSquareClick(square: string) {
    const c = chessRef.current;
    if (selected) {
      if (selected === square) return setSelected(null);
      const legal = c.moves({ square: selected, verbose: true }).some((m) => m.to === square);
      if (legal) return void playerMove(selected, square);
    }
    const p = c.get(square as Square);
    setSelected(p && p.color === player ? (square as Square) : null);
  }

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    const last = records.at(-1);
    if (last) {
      s[last.uci.slice(0, 2)] = sq.last;
      s[last.uci.slice(2, 4)] = sq.last;
    }
    if (selected) s[selected] = sq.key;
    if (threat?.revealed) for (const t of threat.t.squares) s[t] = sq.threat;
    if (hint && hint.level >= 2) s[hint.h.keySquare] = sq.key;
    return s;
  }, [records, selected, threat, hint]);

  const arrows = useMemo(() => {
    const a: { startSquare: string; endSquare: string; color: string }[] = [];
    if (threat?.revealed && threat.t.arrow) a.push({ startSquare: threat.t.arrow.from, endSquare: threat.t.arrow.to, color: cssVar("--blunder") });
    if (hint && hint.level >= 3) a.push({ startSquare: hint.h.from, endSquare: hint.h.to, color: cssVar("--arrow-best") });
    return a;
  }, [threat, hint]);

  const orientation = player === "w" ? "white" : "black";
  const myTurn = chessRef.current.turn() === player && !busy && !pending && !over;
  const pairs: [MoveRecord, MoveRecord | undefined][] = [];
  for (let i = 0; i < records.length; i += 2) pairs.push([records[i], records[i + 1]]);

  const ClockView = ({ side }: { side: "w" | "b" }) =>
    tc.base ? (
      <div
        className={cn(
          "rounded-md px-3 py-1 font-mono text-lg font-semibold tabular-nums",
          chessRef.current.turn() === side && !over ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          clock[side] < 30000 && "text-destructive",
        )}
      >
        {fmtClock(clock[side])}
      </div>
    ) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,560px)_1fr]">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Stockfish ~{elo}{busy && !pending && chessRef.current.turn() === bot ? " · thinking…" : ""}</span>
          <ClockView side={bot} />
        </div>
        <div className="flex gap-2">
          {showEval && <EvalBar cp={evalNow.cp} mate={evalNow.mate} orientation={orientation} />}
          <div className="min-w-0 flex-1">
            <Board
              position={fen}
              boardOrientation={orientation}
              squareStyles={squareStyles}
              arrows={arrows}
              allowDragging={myTurn}
              onPieceDrop={({ sourceSquare, targetSquare }) => {
                if (!targetSquare) return false;
                const c = chessRef.current;
                const legal = c.moves({ square: sourceSquare as Square, verbose: true }).some((m) => m.to === targetSquare);
                if (!legal || !myTurn) return false;
                void playerMove(sourceSquare, targetSquare);
                return true;
              }}
              onSquareClick={({ square }) => myTurn && onSquareClick(square)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{profile?.display_name ?? "You"}</span>
          <ClockView side={player} />
        </div>
      </div>

      <div className="space-y-4">
        {coach === "full" && (
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex min-h-7 items-center gap-2">
              {lastLabel ? (
                <>
                  <MoveLabelBadge label={lastLabel.label} />
                  <span className="text-sm text-muted-foreground">{lastLabel.san}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Coach is watching.</span>
              )}
            </div>
            {threat && (
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-sm font-semibold">What is your opponent threatening?</p>
                {threat.revealed ? (
                  <p className="mt-1 text-sm">{threat.t.text}</p>
                ) : (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setThreat({ ...threat, revealed: true })}>
                    <Eye className="h-4 w-4" /> Show me
                  </Button>
                )}
              </div>
            )}
            <div className="flex items-start gap-3">
              <Button size="sm" variant="secondary" onClick={nextHint} disabled={!myTurn || (hint?.level ?? 0) >= 3}>
                <Lightbulb className="h-4 w-4" /> Hint {hint ? `${Math.min(hint.level + 1, 3)}/3` : ""}
              </Button>
              {hint && (
                <p className="text-sm">
                  {hint.h.nudge}
                  {hint.level >= 2 && <span className="text-muted-foreground"> Look at the highlighted piece.</span>}
                  {hint.level >= 3 && <span className="text-muted-foreground"> The arrow shows the best move.</span>}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowEval((v) => !v)}>
            {showEval ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {showEval ? "Hide" : "Show"} eval
          </Button>
          {!over && (
            <Button size="sm" variant="outline" onClick={() => finish({ result: player === "w" ? "0-1" : "1-0", reason: "You resigned" })}>
              <Flag className="h-4 w-4" /> Resign
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onNew}>
            <RotateCcw className="h-4 w-4" /> New game
          </Button>
          {coach !== "off" && <span className="self-center text-sm text-muted-foreground">Take-backs: {takebacks}</span>}
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border bg-card p-3">
          {pairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Moves will appear here.</p>
          ) : (
            <ol className="grid grid-cols-[2rem_1fr_1fr] gap-y-1 text-sm">
              {pairs.map(([w, b], i) => (
                <li key={i} className="contents">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  {[w, b].map((m, j) => (
                    <span key={j} className={cn("font-medium", m?.label && coach === "full" && labelText[m.label])}>
                      {m?.san ?? ""}
                    </span>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <Dialog open={!!pending}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} className="[&>button]:hidden">
          <DialogHeader>
            <DialogTitle>This move loses material</DialogTitle>
            <DialogDescription>
              {pending?.rec.san} drops your evaluation by about {pending ? (evalLoss(pending.rec.evalBefore, pending.rec.evalAfter, player) / 100).toFixed(1) : 0} pawns.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={keepMove}>Keep move</Button>
            <Button onClick={takeBack}>Take back</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!over}>
        <DialogContent className="[&>button]:hidden">
          <DialogHeader>
            <DialogTitle>{over?.reason}</DialogTitle>
            <DialogDescription>Result {over?.result}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(["blunder", "mistake", "inaccuracy"] as const).map((l) => (
              <div key={l} className="rounded-lg bg-secondary p-2">
                <div className={cn("font-display text-2xl font-bold", labelText[l])}>{records.filter((r) => r.byPlayer && r.label === l).length}</div>
                <div className="text-xs text-muted-foreground">{LABEL_TEXT[l]}s</div>
              </div>
            ))}
          </div>
          {coach !== "off" && <p className="text-sm">Take-backs used: <span className="font-semibold">{takebacks}</span></p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onNew}>New game</Button>
            <Button disabled={!savedId} onClick={() => navigate({ to: "/review/$gameId", params: { gameId: savedId! } })}>
              {savedId ? "Review game" : "Saving…"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
