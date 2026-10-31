// Stockfish (WASM, lite single-threaded) wrapper running in a Web Worker.
// Requests are serialized per instance. Scores are normalized to White's POV.

export type EngineLine = { cp: number; mate: number | null; pv: string[] };
export type Analysis = { bestmove: string; lines: EngineLine[]; depth: number };

type Job = {
  fen: string;
  go: string;
  multipv: number;
  resolve: (a: Analysis) => void;
};

export const MATE_CP = 10000;

export class Engine {
  private worker: Worker;
  private queue: Job[] = [];
  private current: Job | null = null;
  private lines: EngineLine[] = [];
  private depth = 0;
  private ready: Promise<void>;
  private multipvSet = 1;

  constructor() {
    this.worker = new Worker("/stockfish/stockfish-19-lite-single.js");
    let markReady: () => void = () => {};
    this.ready = new Promise((r) => (markReady = r));
    this.worker.onmessage = (e: MessageEvent) => {
      const line = String(e.data);
      if (line === "readyok") markReady();
      else this.onLine(line);
    };
    this.send("uci");
    this.send("isready");
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  setOption(name: string, value: string | number) {
    this.send(`setoption name ${name} value ${value}`);
  }

  analyze(fen: string, opts: { depth?: number; movetime?: number; multipv?: number } = {}) {
    const go = opts.movetime ? `go movetime ${opts.movetime}${opts.depth ? ` depth ${opts.depth}` : ""}` : `go depth ${opts.depth ?? 12}`;
    return new Promise<Analysis>((resolve) => {
      this.queue.push({ fen, go, multipv: opts.multipv ?? 1, resolve });
      void this.pump();
    });
  }

  private async pump() {
    if (this.current) return;
    const job = this.queue.shift();
    if (!job) return;
    this.current = job;
    await this.ready;
    this.lines = [];
    this.depth = 0;
    if (job.multipv !== this.multipvSet) {
      this.setOption("MultiPV", job.multipv);
      this.multipvSet = job.multipv;
    }
    this.send(`position fen ${job.fen}`);
    this.send(job.go);
  }

  private onLine(line: string) {
    const job = this.current;
    if (!job) return;
    if (line.startsWith("info") && line.includes(" pv ")) {
      const m = line.match(/multipv (\d+)/);
      const idx = m ? Number(m[1]) - 1 : 0;
      const depth = Number(line.match(/ depth (\d+)/)?.[1] ?? 0);
      const cpM = line.match(/score cp (-?\d+)/);
      const mateM = line.match(/score mate (-?\d+)/);
      const pv = line.split(" pv ")[1]?.trim().split(/\s+/) ?? [];
      const whiteToMove = job.fen.split(" ")[1] === "w";
      const sign = whiteToMove ? 1 : -1;
      let cp = 0;
      let mate: number | null = null;
      if (mateM) {
        const n = Number(mateM[1]);
        mate = n * sign;
        cp = (n > 0 ? MATE_CP - Math.abs(n) : -(MATE_CP - Math.abs(n))) * sign;
      } else if (cpM) cp = Number(cpM[1]) * sign;
      this.lines[idx] = { cp, mate, pv };
      if (idx === 0) this.depth = depth;
    } else if (line.startsWith("bestmove")) {
      const bestmove = line.split(" ")[1] ?? "";
      this.current = null;
      const lines = this.lines.filter(Boolean);
      if (!lines.length) {
        // Terminal position (mate/stalemate) — no info lines.
        lines.push({ cp: 0, mate: null, pv: [] });
      }
      job.resolve({ bestmove: bestmove === "(none)" ? "" : bestmove, lines, depth: this.depth });
      void this.pump();
    }
  }

  clear() {
    this.queue = [];
  }

  terminate() {
    this.worker.terminate();
  }
}

/** Map an approximate Elo (800–2400) to Stockfish skill level + depth limit. */
export function eloToEngineSettings(elo: number) {
  const e = Math.min(2400, Math.max(800, elo));
  const t = (e - 800) / 1600;
  return {
    skill: Math.round(t * 20),
    depth: Math.max(1, Math.round(1 + t * 13)),
    movetime: Math.round(150 + t * 850),
  };
}
