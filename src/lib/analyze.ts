import { Chess } from "chess.js";
import type { Engine, Analysis } from "./engine";
import { categorizeMistake, classifyMove, evalLoss, pvToSan } from "./coach";
import type { MoveRecord } from "./types";

/** Build a MoveRecord from coach analyses of the position before and after a move. */
export function buildRecord(args: {
  ply: number;
  fenBefore: string;
  fenAfter: string;
  san: string;
  uci: string;
  color: "w" | "b";
  before: Analysis;
  after: Analysis;
  byPlayer: boolean;
}): MoveRecord {
  const { before, after } = args;
  const evalBefore = before.lines[0]?.cp ?? 0;
  const evalAfter = after.lines[0]?.cp ?? 0;
  const rec: MoveRecord = {
    ply: args.ply,
    san: args.san,
    uci: args.uci,
    color: args.color,
    fenBefore: args.fenBefore,
    fenAfter: args.fenAfter,
    evalBefore,
    evalAfter,
    mateAfter: after.lines[0]?.mate ?? null,
    bestUci: before.bestmove,
    bestLine: pvToSan(args.fenBefore, before.lines[0]?.pv ?? [before.bestmove]),
    byPlayer: args.byPlayer,
  };
  if (args.byPlayer) {
    const loss = evalLoss(evalBefore, evalAfter, args.color);
    rec.label = classifyMove(loss, args.uci === before.bestmove);
    if (rec.label === "mistake" || rec.label === "blunder") {
      rec.mistakeType = categorizeMistake(args.fenBefore, args.fenAfter, after.bestmove || null);
    }
  }
  return rec;
}

/** Analyze a full game from PGN with the coach engine. */
export async function analyzePgn(engine: Engine, pgn: string, playerColor: "w" | "b", movetime = 120) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });
  const fens = [history[0]?.before ?? new Chess().fen(), ...history.map((m) => m.after)];
  const analyses: Analysis[] = [];
  for (const fen of fens) analyses.push(await engine.analyze(fen, { movetime, depth: 14 }));
  return history.map((m, i) =>
    buildRecord({
      ply: i + 1,
      fenBefore: m.before,
      fenAfter: m.after,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ""),
      color: m.color,
      before: analyses[i],
      after: analyses[i + 1],
      byPlayer: m.color === playerColor,
    }),
  );
}
