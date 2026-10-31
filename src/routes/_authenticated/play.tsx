import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Eye, Flag, RotateCcw, EyeOff, Undo2, Trash2, Play } from "lucide-react";
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
import { cssVar, profileQuery, unfinishedGamesQuery } from "@/lib/queries";
import type { MoveRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { CapturedMaterial } from "@/components/CapturedMaterial";
import { CoachWhy } from "@/components/CoachWhy";
import { TIME_CONTROLS, restoreChess, materialAt, isRatedUsage, legalTargets, type GameSettings, type GameSnapshot } from "@/lib/game-session";
import { persistSession, deleteSession } from "@/lib/session-data";

export const Route = createFileRoute("/_authenticated/play")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Play — Chess Yoda" },
      { name: "description", content: "Play the engine with an optional safety net and live coaching." },
      { property: "og:title", content: "Play — Chess Yoda" },
      { property: "og:description", content: "Play the engine with an optional safety net and live coaching." },
    ],
  }),
  component: PlayPage,
});

type CoachMode = "off" | "safety" | "full";
const COACH_MODES: { id: CoachMode; label: string; desc: string }[] = [
  { id: "off", label: "Off", desc: "Normal game, no help." },
  { id: "safety", label: "Safety net", desc: "Warns you before a move loses material." },
  { id: "full", label: "Full coach", desc: "Safety net, threat check, hints and move labels." },
];

type Settings = GameSettings;
type Over = { result: string; reason: string };

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function PlayPage() {
  const [session, setSession] = useState<{ id: string; settings: Settings; snapshot?: GameSnapshot } | null>(null);
  const queryClient = useQueryClient();
  if (!session) return <Setup onStart={(settings) => setSession({ id: crypto.randomUUID(), settings })} onResume={(id, snapshot) => setSession({ id, settings: snapshot.settings, snapshot })} />;
  return <Game key={session.id} id={session.id} settings={session.settings} initial={session.snapshot} onNew={() => { setSession(null); void queryClient.invalidateQueries({ queryKey: ["unfinished-games"] }); }} />;
}

function Setup({ onStart, onResume }: { onStart: (s: Settings) => void; onResume: (id: string, snapshot: GameSnapshot) => void }) {
  const [color, setColor] = useState<"w" | "b" | "r">("w");
  const [tc, setTc] = useState<(typeof TIME_CONTROLS)[number]>(TIME_CONTROLS[3]);
  const [elo, setElo] = useState(1500);
  const [coach, setCoach] = useState<CoachMode>("full");
  const [allowTakebacks, setAllowTakebacks] = useState(true);
  const [showPossibleMoves, setShowPossibleMoves] = useState(true);
  const { data: unfinished = [] } = useQuery(unfinishedGamesQuery);
  const queryClient = useQueryClient();
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
        <Slider min={800} max={2400} step={50} value={[elo]} onValueChange={([v]) => setElo(v ?? 1500)} />
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
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3">Allow take-backs <Switch aria-label="Allow take-backs" checked={allowTakebacks} onCheckedChange={setAllowTakebacks} /></label>
        <label className="flex items-center justify-between gap-3">Show possible moves <Switch aria-label="Show possible moves" checked={showPossibleMoves} onCheckedChange={setShowPossibleMoves} /></label>
      </div>
      <Button size="lg" className="w-full" onClick={() => onStart({ color: color === "r" ? (Math.random() < 0.5 ? "w" : "b") : color, tc, elo, coach, allowTakebacks, showPossibleMoves })}>
        Start game
      </Button>
      {unfinished.length > 0 && <section className="space-y-3"><h2 className="text-xl font-semibold">Continue a game</h2>
        {unfinished.map((game) => {
          const snapshot = game.snapshot as unknown as GameSnapshot | null;
          if (!snapshot) return null;
          return <div key={game.id} className="flex items-center gap-4 border p-3">
            <div className="w-24 shrink-0"><Board position={game.current_fen ?? snapshot.fen} allowDragging={false} showNotation={false} /></div>
            <div className="min-w-0 flex-1"><p className="text-sm">Opponent ~{game.opponent_elo}</p><p className="text-xs text-muted-foreground">{new Date(game.updated_at).toLocaleDateString()} · Move {new Chess(snapshot.fen).moveNumber()}</p>
              <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => onResume(game.id, snapshot)}><Play className="h-4 w-4" /> Resume</Button>
              <Button size="icon" variant="ghost" aria-label="Delete saved game" onClick={async () => { try { await deleteSession(game.id); await queryClient.invalidateQueries({ queryKey: ["unfinished-games"] }); } catch { toast.error("Couldn't delete the saved game."); } }}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          </div>;
        })}
      </section>}
    </div>
  );
}

function Game({ settings, onNew, id, initial }: { settings: Settings; onNew: () => void; id: string; initial: GameSnapshot | undefined }) {
  const { color: player, tc, elo, coach } = settings;
  const bot = player === "w" ? "b" : "w";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQuery);

  const chessRef = useRef(initial ? restoreChess(initial) : new Chess());
  const coachRef = useRef<Engine | null>(null);
  const oppRef = useRef<Engine | null>(null);
  const cache = useRef(new Map<string, Promise<Analysis>>());
  const recordsRef = useRef<MoveRecord[]>(initial?.records ?? []);
  const overRef = useRef<Over | null>(null);

  const [fen, setFen] = useState(chessRef.current.fen());
  const [records, setRecords] = useState<MoveRecord[]>(initial?.records ?? []);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ rec: MoveRecord } | null>(initial?.pending ? { rec: initial.pending } : null);
  const [takebacks, setTakebacks] = useState(initial?.takebacks ?? 0);
  const takebacksRef = useRef(initial?.takebacks ?? 0);
  const [lastLabel, setLastLabel] = useState<GameSnapshot["lastLabel"]>(initial?.lastLabel ?? null);
  const [threat, setThreat] = useState<GameSnapshot["threat"]>(initial?.threat ?? null);
  const [hint, setHint] = useState<GameSnapshot["hint"]>(initial?.hint ?? null);
  const [showEval, setShowEval] = useState(initial?.showEval ?? true);
  const [evalNow, setEvalNow] = useState<{ cp: number; mate: number | null }>(initial?.evalNow ?? { cp: 20, mate: null });
  const [over, setOver] = useState<Over | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [clock, setClock] = useState(initial?.clock ?? { w: tc.base * 1000, b: tc.base * 1000 });
  const [hintsUsed, setHintsUsed] = useState(initial?.hintsUsed ?? 0);
  const hintsRef = useRef(initial?.hintsUsed ?? 0);
  const clockHistory = useRef(initial?.clockHistory ?? []);
  const revision = useRef(0);
  const mounted = useRef(true);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const saving = useRef(Promise.resolve());
  const [saveStatus, setSaveStatus] = useState("Saving…");
  const enqueueSave = useCallback((snapshot: GameSnapshot) => {
    saving.current = saving.current.catch(() => {}).then(async () => {
      try { await persistSession(id, snapshot); if (mounted.current) setSaveStatus("Saved"); }
      catch { if (mounted.current) setSaveStatus("Save failed — retrying"); }
    });
    return saving.current;
  }, [id]);
  const clockRef = useRef(clock);
  clockRef.current = clock;

  snapshotRef.current = { version: 1, settings, fen, pgn: chessRef.current.pgn(), records,
    clock, clockHistory: clockHistory.current, takebacks, hintsUsed, pending: pending?.rec ?? null,
    lastLabel, threat, hint, showEval, evalNow };
  useEffect(() => {
    if (!overRef.current && snapshotRef.current) { setSaveStatus("Saving…"); void enqueueSave(snapshotRef.current); }
  }, [fen, records, pending, takebacks, hintsUsed, lastLabel, threat, hint, showEval, enqueueSave]);
  useEffect(() => {
    const pause = () => { if (!overRef.current && snapshotRef.current) void enqueueSave({ ...snapshotRef.current, clock: { ...clockRef.current } }); };
    const tick = setInterval(pause, 2000);
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("pagehide", pause);
    return () => { clearInterval(tick); document.removeEventListener("visibilitychange", pause); window.removeEventListener("pagehide", pause); pause(); };
  }, [enqueueSave]);

  const analyze = useCallback((f: string) => {
    let p = cache.current.get(f);
    if (!p) {
      const engine = coachRef.current;
      if (!engine) return Promise.reject(new Error("Engine unavailable"));
      p = engine.analyze(f, { depth: 12, multipv: 2 });
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
        await saving.current;
        const completedId = await saveGame({
          id,
          hintsUsed: hintsRef.current,
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
        setSavedId(completedId);
        queryClient.invalidateQueries();
      } catch (e) {
        toast.error("Couldn't save the game.");
      }
    },
    [id, player, elo, coach, tc.id, queryClient],
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
    if (tc.base && tc.inc) { clockRef.current = { ...clockRef.current, [side]: clockRef.current[side] + tc.inc * 1000 }; setClock(clockRef.current); }
  };

  const botMove = useCallback(async () => {
    const c = chessRef.current;
    setBusy(true);
    const s = eloToEngineSettings(elo);
    const opp = oppRef.current;
    if (!opp || c.turn() !== bot || overRef.current || !mounted.current) { setBusy(false); return; }
    const token = revision.current;
    opp.setOption("Skill Level", s.skill);
    const start = Date.now();
    const fenBefore = c.fen();
    const res = await opp.analyze(fenBefore, { depth: s.depth, movetime: s.movetime });
    const wait = 450 - (Date.now() - start);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (overRef.current || !mounted.current || token !== revision.current || c.fen() !== fenBefore) return;
    clockHistory.current.push({ ...clockRef.current });
    const uci = res.bestmove;
    const move = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
    setFen(c.fen());
    addIncrement(bot);
    const [before, after] = await Promise.all([analyze(fenBefore), analyze(c.fen())]);
    if (!mounted.current || token !== revision.current) return;
    pushRecord(
      buildRecord({ ply: recordsRef.current.length + 1, fenBefore, fenAfter: c.fen(), san: move.san, uci, color: bot, before, after, byPlayer: false }),
    );
    if (checkOver()) return;
    if (coach === "full") {
      const nf = nullMoveFen(c.fen());
      let tMove: string | null = null;
      let gain = 0;
      if (nf) {
        const engine = coachRef.current;
        if (!engine) return;
        const ta = await engine.analyze(nf, { depth: 10 });
        if (!mounted.current || token !== revision.current) return;
        tMove = ta.bestmove || null;
        const sign = bot === "w" ? 1 : -1;
        gain = ((ta.lines[0]?.cp ?? 0) - (after.lines[0]?.cp ?? 0)) * sign;
      }
      const rec = recordsRef.current.at(-1);
      if (rec) setThreat({ t: describeThreat(c.fen(), player, tMove, gain), revealed: false, rec });
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elo, bot, player, coach, analyze, checkOver]);

  const commitPlayer = useCallback(
    (rec: MoveRecord) => {
      pushRecord(rec);
      if (coach === "full" && rec.label) setLastLabel({ label: rec.label, san: rec.san, rec });
      addIncrement(player);
      if (checkOver()) return;
      void botMove();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coach, player, checkOver, botMove],
  );

  // Engines lifecycle
  useEffect(() => {
    mounted.current = true;
    cache.current.clear();
    coachRef.current = new Engine();
    oppRef.current = new Engine();
    void analyze(chessRef.current.fen());
    if (!initial?.pending && chessRef.current.turn() === bot) void botMove().catch(() => { if (mounted.current) setBusy(false); });
    return () => {
      mounted.current = false;
      revision.current += 1;
      coachRef.current?.terminate();
      oppRef.current?.terminate();
      cache.current.clear();
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
      if (document.hidden) return;
      if (chessRef.current.history().length === 0 && player === "w") return; // clock starts after first move
      const side = chessRef.current.turn();
      const next = clockRef.current[side] - dt;
      clockRef.current = { ...clockRef.current, [side]: next };
      setClock(clockRef.current);
      if (next <= 0) {
        void finish({ result: side === "w" ? "0-1" : "1-0", reason: side === player ? "You lost on time" : "Opponent flagged" });
      }
    }, 200);
    return () => clearInterval(id);
  }, [tc.base, over, player, finish]);

  async function playerMove(from: string, to: string): Promise<boolean> {
    const c = chessRef.current;
    if (busy || pending || over || c.turn() !== player) return false;
    const token = revision.current;
    const beforeClock = { ...clockRef.current };
    let move: Move;
    try {
      move = c.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    clockHistory.current.push(beforeClock);
    setFen(c.fen());
    setSelected(null);
    setThreat(null);
    setHint(null);
    setLastLabel(null);
    setBusy(true);
    const [before, after] = await Promise.all([analyze(move.before), analyze(move.after)]);
    if (overRef.current || !mounted.current || token !== revision.current) return true;
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
      setPending({ rec });
      return true;
    }
    commitPlayer(rec);
    return true;
  }

  function takeBack() {
    if (!settings.allowTakebacks || overRef.current) return;
    revision.current += 1;
    const c = chessRef.current;
    if (pending) {
      c.undo();
      const previous = clockHistory.current.pop();
      if (previous) { clockRef.current = previous; setClock(previous); }
    } else {
      const lastPlayer = recordsRef.current.findLastIndex((record) => record.byPlayer);
      if (lastPlayer < 0) return;
      while (c.history().length > lastPlayer) {
        c.undo();
        const previous = clockHistory.current.pop();
        if (previous) clockRef.current = previous;
      }
      recordsRef.current = recordsRef.current.slice(0, lastPlayer);
      setRecords(recordsRef.current);
      setClock({ ...clockRef.current });
    }
    takebacksRef.current += 1;
    setTakebacks(takebacksRef.current);
    setFen(c.fen());
    setPending(null); setThreat(null); setHint(null); setLastLabel(null); setSelected(null); setBusy(false);
    const previous = recordsRef.current.at(-1);
    setEvalNow({ cp: previous?.evalAfter ?? 20, mate: previous?.mateAfter ?? null });
  }
  function keepMove() {
    if (!pending) return;
    const rec = pending.rec;
    setPending(null);
    commitPlayer(rec);
  }

  async function nextHint() {
    if (!myTurn) return;
    if (hint) {
      hintsRef.current += 1; setHintsUsed(hintsRef.current);
      return setHint({ ...hint, level: Math.min(3, hint.level + 1) });
    }
    const position = chessRef.current.fen();
    const a = await analyze(position);
    if (chessRef.current.fen() !== position || !mounted.current) return;
    const h = buildHint(position, player, a.bestmove, a.lines);
    if (h) { hintsRef.current += 1; setHintsUsed(hintsRef.current); setHint({ h, level: 1 }); }
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

  const material = useMemo(() => materialAt(chessRef.current.pgn()), [fen]);
  const targets = useMemo(() => settings.showPossibleMoves && selected ? legalTargets(fen, selected) : [], [fen, selected, settings.showPossibleMoves]);
  const orientation = player === "w" ? "white" : "black";
  const myTurn = chessRef.current.turn() === player && !busy && !pending && !over;
  const pairs: [MoveRecord, MoveRecord | undefined][] = [];
  for (let i = 0; i < records.length; i += 2) { const record = records[i]; if (record) pairs.push([record, records[i + 1]]); }

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
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">Stockfish ~{elo}{busy && !pending && chessRef.current.turn() === bot ? " · thinking…" : ""}</span><CapturedMaterial material={material} side={bot} /></div>
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
              onPieceDrag={({ square }) => { if (myTurn) setSelected(square as Square); }}
              onPieceDragCancel={() => setSelected(null)}
              squareRenderer={({ square, children }) => <>{children}{targets.some((target) => target.square === square) && <span className={targets.find((target) => target.square === square)?.capture ? "legal-target-ring" : "legal-target-dot"} />}</>}
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
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{profile?.display_name ?? "You"}</span><CapturedMaterial material={material} side={player} />{!isRatedUsage(takebacks, hintsUsed) && <span className="text-xs text-muted-foreground">Unrated</span>}</div>
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
                  {["inaccuracy", "mistake", "blunder"].includes(lastLabel.label) && <CoachWhy key={lastLabel.rec.uci + lastLabel.rec.ply} record={lastLabel.rec} rating={profile?.rating ?? 1400} />}
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
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => { hintsRef.current += 1; setHintsUsed(hintsRef.current); setThreat({ ...threat, revealed: true }); }}>
                    <Eye className="h-4 w-4" /> Show me
                  </Button>
                )}
                <CoachWhy key={threat.rec.uci + threat.rec.ply} record={threat.rec} rating={profile?.rating ?? 1400} />
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

        <p className="text-xs text-muted-foreground" role="status">{saveStatus}</p>
        <div className="flex flex-wrap gap-2">
          {settings.allowTakebacks && !over && <Button size="sm" variant="outline" onClick={takeBack} disabled={!records.some((record) => record.byPlayer) && !pending}><Undo2 className="h-4 w-4" /> Undo</Button>}
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
          {pending && <CoachWhy key={pending.rec.uci + pending.rec.ply} record={pending.rec} rating={profile?.rating ?? 1400} />}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={keepMove}>Keep move</Button>
            {settings.allowTakebacks && <Button onClick={takeBack}>Take back</Button>}
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
            <Button disabled={!savedId} onClick={() => { if (savedId) void navigate({ to: "/review/$gameId", params: { gameId: savedId } }); }}>
              {savedId ? "Review game" : "Saving…"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
