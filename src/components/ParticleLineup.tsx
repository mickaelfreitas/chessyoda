import { useEffect, useRef } from "react";

/**
 * A row of chess pieces made of glowing particles, rising from pawn to king.
 * Each piece spins on its own axis; a scan line sweeps up through the row.
 */

type Props = {
  color?: string;
  /** Total particles across all pieces (6000–20000 works well) */
  particles?: number;
  /** Rotation speed (0 = still) */
  spin?: number;
  className?: string;
};

type Prof = [number, number][]; // [height, radius], height from -1 (base) to 1 (top)
type PieceDef = {
  scale: number;
  lines: Prof[];
  cross?: boolean;
  skip?: (x: number, y: number, z: number, th: number, r: number) => boolean;
};
type Pt = { x: number; y: number; z: number; p: number };

const DEG = Math.PI / 180;
const arc = (cy: number, ry: number, rx: number, a0: number, a1: number, n = 14): Prof => {
  const out: Prof = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * DEG;
    out.push([cy + ry * Math.sin(a), Math.max(0, rx * Math.cos(a))]);
  }
  return out;
};
const BASE: Prof = [[-1, 0], [-1, 0.66], [-0.86, 0.66], [-0.8, 0.52], [-0.7, 0.5]];

const PIECES: PieceDef[] = [
  { // pawn
    scale: 0.58,
    lines: [[...BASE, [-0.6, 0.34], [-0.1, 0.22], [0.08, 0.2], [0.14, 0.38], [0.22, 0.38], [0.26, 0.2], ...arc(0.62, 0.38, 0.38, -60, 90)]],
  },
  { // rook
    scale: 0.7,
    lines: [[...BASE, [-0.6, 0.38], [0.5, 0.32], [0.58, 0.48], [1, 0.48], [1, 0.34], [0.84, 0.34], [0.84, 0]]],
    skip: (_x, y, _z, th) => y > 0.84 && Math.sin(th * 4) > 0.45,
  },
  { // bishop
    scale: 0.84,
    lines: [
      [...BASE.slice(0, 4), [-0.7, 0.46], [-0.6, 0.32], [0, 0.2], [0.06, 0.34], [0.12, 0.34], [0.16, 0.18], ...arc(0.48, 0.34, 0.28, -70, 90)],
      arc(0.9, 0.08, 0.08, -90, 90, 8),
    ],
    skip: (x, y, z) => y > 0.4 && y < 0.74 && z > 0 && Math.abs(x - (y - 0.57) * 0.9) < 0.04,
  },
  { // queen
    scale: 0.94,
    lines: [
      [...BASE, [-0.6, 0.34], [0.2, 0.2], [0.28, 0.34], [0.34, 0.34], [0.38, 0.22], [0.46, 0.24], [0.66, 0.4], [0.72, 0.4], [0.74, 0.24], [0.84, 0.14], [0.88, 0]],
      arc(0.95, 0.06, 0.06, -90, 90, 8),
    ],
    skip: (_x, y, _z, th, r) => y > 0.6 && y < 0.73 && r > 0.3 && Math.sin(th * 9) < -0.25,
  },
  { // king
    scale: 1,
    lines: [[[-1, 0], [-1, 0.64], [-0.9, 0.64], [-0.86, 0.52], [-0.78, 0.5], [-0.72, 0.38], [-0.6, 0.3], [-0.3, 0.22], [0.1, 0.18], [0.22, 0.2], [0.26, 0.33], [0.32, 0.33], [0.36, 0.22], [0.44, 0.24], [0.6, 0.35], [0.66, 0.35], [0.68, 0]]],
    cross: true,
  },
];

function samplePiece(def: PieceDef, n: number, p: number): Pt[] {
  const segs: { a: [number, number]; b: [number, number]; c: number }[] = [];
  let total = 0;
  for (const line of def.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      if (!a || !b) continue;
      total += Math.hypot(b[0] - a[0], b[1] - a[1]) * ((a[1] + b[1]) / 2 + 0.02);
      segs.push({ a, b, c: total });
    }
  }
  const out: Pt[] = [];
  const bodyN = def.cross ? Math.floor(n * 0.88) : n;
  let guard = 0;
  while (out.length < bodyN && guard++ < n * 4) {
    const r0 = Math.random() * total;
    const s = segs.find((g) => g.c >= r0) ?? segs[segs.length - 1];
    if (!s) continue;
    const u = Math.random();
    const y = s.a[0] + (s.b[0] - s.a[0]) * u;
    const r = s.a[1] + (s.b[1] - s.a[1]) * u;
    const th = Math.random() * Math.PI * 2;
    const x = r * Math.cos(th), z = r * Math.sin(th);
    if (def.skip && def.skip(x, y, z, th, r)) continue;
    out.push({ x, y, z, p });
  }
  if (def.cross) {
    const boxes: [number, number, number, number][] = [[-0.05, 0.05, 0.68, 1.0], [-0.17, 0.17, 0.8, 0.87]];
    for (let i = bodyN; i < n; i++) {
      const b = boxes[Math.random() < 0.6 ? 0 : 1];
      if (!b) continue;
      const f = Math.floor(Math.random() * 4);
      let x = b[0] + Math.random() * (b[1] - b[0]);
      let y = b[2] + Math.random() * (b[3] - b[2]);
      let z = (Math.random() - 0.5) * 0.1;
      if (f === 0) z = 0.05;
      else if (f === 1) z = -0.05;
      else if (f === 2) x = Math.random() < 0.5 ? b[0] : b[1];
      else y = Math.random() < 0.5 ? b[2] : b[3];
      out.push({ x, y, z, p });
    }
  }
  return out;
}

function buildAll(total: number): Pt[] {
  const w = PIECES.map((d) => d.scale * d.scale);
  const sum = w.reduce((a, b) => a + b, 0);
  return PIECES.flatMap((d, i) => samplePiece(d, Math.round((total * (w[i] ?? 0)) / sum), i));
}

export default function ParticleLineup({
  color = "",
  particles = 16000,
  spin = 0.35,
  className,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const opts = useRef({ color, spin });
  opts.current = { color, spin };

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const pts = buildAll(particles);

    // Horizontal layout: pieces side by side, centred
    const gap = 0.24;
    const widths = PIECES.map((d) => 1.3 * d.scale);
    const rowW = widths.reduce((a, b) => a + b, 0) + gap * (PIECES.length - 1);
    const offX: number[] = [];
    let acc = -rowW / 2;
    widths.forEach((wd) => { offX.push(acc + wd / 2); acc += wd + gap; });

    const fit = () => {
      const r = c.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(r.width * d));
      c.height = Math.max(1, Math.round(r.height * d));
    };
    fit();
    const ro = new ResizeObserver(() => { fit(); if (still) frame(); });
    ro.observe(c);

    let mx = 0, my = 0;
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      my = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onLeave = () => { mx = 0; my = 0; };
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerleave", onLeave);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, t = 0, yaw = 0, gy = 0, tilt = 0.12;
    const ca = new Float32Array(PIECES.length), sa = new Float32Array(PIECES.length);

    const frame = () => {
      const w = c.width, h = c.height, d = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, w, h);
      t += 0.016;
      yaw += 0.016 * opts.current.spin;
      gy += (mx * 0.25 - gy) * 0.05;
      tilt += (0.12 + my * 0.08 - tilt) * 0.05;
      for (let i = 0; i < PIECES.length; i++) { ca[i] = Math.cos(yaw + i * 0.7); sa[i] = Math.sin(yaw + i * 0.7); }
      const cg = Math.cos(gy), sg = Math.sin(gy), ct = Math.cos(tilt), st = Math.sin(tilt);
      const S = Math.min(w / (rowW + 0.5), h / 2.5);
      const cx = w / 2, cy = h / 2;
      const scan = ((t * 0.28) % 1) * 2.4 - 1.2;
      const size = Math.max(1, 1.1 * d);
      ctx.fillStyle = opts.current.color || getComputedStyle(c).getPropertyValue("--orb-particle").trim();

      for (const q of pts) {
        const def = PIECES[q.p];
        if (!def) continue;
        const s = def.scale;
        const cos = ca[q.p] ?? 1, sin = sa[q.p] ?? 0;
        const wx = (offX[q.p] ?? 0) + (q.x * cos - q.z * sin) * s;
        const wz = (q.x * sin + q.z * cos) * s;
        const wy = -1 + (q.y + 1) * s;
        const gx = wx * cg - wz * sg;
        const gz = wx * sg + wz * cg;
        const y1 = wy * ct - gz * st;
        const z2 = wy * st + gz * ct;
        const k = 4 / (4 + z2);
        const depth = 0.2 + 0.68 * Math.min(1, Math.max(0, (0.7 - z2) / 1.4));
        const dy = wy - scan;
        const band = Math.exp(-(dy * dy) / 0.003);
        ctx.globalAlpha = Math.min(1, depth + band * 0.9);
        const sz = size * (1 + band * 0.8);
        ctx.fillRect(cx + gx * S * k, cy - y1 * S * k, sz, sz);
      }
      ctx.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerleave", onLeave);
    };
  }, [particles]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="A row of chess pieces made of glowing particles, rising from pawn to king"
      className={className}
      
    />
  );
}
