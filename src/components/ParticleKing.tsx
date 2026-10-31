import { useEffect, useRef } from "react";

type ParticleKingProps = {
  /** Particle colour */
  color?: string;
  /** Number of particles (2000–14000 works well) */
  particles?: number;
  /** Rotation speed (0 = still) */
  spin?: number;
  className?: string;
};

type Pt = { x: number; y: number; z: number };

function buildPoints(n: number): Pt[] {
  // Silhouette of a king, as [height, radius] pairs from base to crown
  const prof: [number, number][] = [
    [-1, 0], [-1, 0.64], [-0.9, 0.64], [-0.86, 0.52], [-0.78, 0.5], [-0.72, 0.38],
    [-0.6, 0.3], [-0.3, 0.22], [0.1, 0.18], [0.22, 0.2], [0.26, 0.33], [0.32, 0.33],
    [0.36, 0.22], [0.44, 0.24], [0.6, 0.35], [0.66, 0.35], [0.68, 0],
  ];
  const segs: { a: [number, number]; b: [number, number]; c: number }[] = [];
  let total = 0;
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i], b = prof[i + 1];
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    total += len * ((a[1] + b[1]) / 2 + 0.02);
    segs.push({ a, b, c: total });
  }

  const pts: Pt[] = [];
  const bodyN = Math.floor(n * 0.88);
  for (let i = 0; i < bodyN; i++) {
    const r0 = Math.random() * total;
    const s = segs.find((g) => g.c >= r0) ?? segs[segs.length - 1];
    if (!s) continue;
    const u = Math.random();
    const y = s.a[0] + (s.b[0] - s.a[0]) * u;
    const r = s.a[1] + (s.b[1] - s.a[1]) * u;
    const th = Math.random() * Math.PI * 2;
    pts.push({ x: r * Math.cos(th), y, z: r * Math.sin(th) });
  }

  // The cross on top: a vertical and a horizontal bar
  const boxes: [number, number, number, number][] = [[-0.05, 0.05, 0.68, 1.0], [-0.17, 0.17, 0.8, 0.87]];
  for (let i = bodyN; i < n; i++) {
    const b = boxes[Math.random() < 0.6 ? 0 : 1];
    if (!b) continue;
    const face = Math.floor(Math.random() * 4);
    let x = b[0] + Math.random() * (b[1] - b[0]);
    let y = b[2] + Math.random() * (b[3] - b[2]);
    let z = (Math.random() - 0.5) * 0.1;
    if (face === 0) z = 0.05;
    else if (face === 1) z = -0.05;
    else if (face === 2) x = Math.random() < 0.5 ? b[0] : b[1];
    else y = Math.random() < 0.5 ? b[2] : b[3];
    pts.push({ x, y, z });
  }
  return pts;
}

export default function ParticleKing({
  color = "",
  particles = 7000,
  spin = 0.35,
  className,
}: ParticleKingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opts = useRef({ color, spin });
  opts.current = { color, spin };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const pts = buildPoints(particles);
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
    let raf = 0, t = 0, yaw = 0, tilt = 0.2;

    const frame = () => {
      const w = c.width, h = c.height, d = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, w, h);
      t += 0.016;
      yaw += 0.016 * opts.current.spin;
      tilt += (0.2 + my * 0.12 - tilt) * 0.05;

      const ry = yaw + mx * 0.35;
      const cy = Math.cos(ry), sy = Math.sin(ry);
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const S = Math.min(w, h) * 0.4, cx = w / 2, cyy = h / 2 + S * 0.05;
      const scan = ((t * 0.28) % 1) * 2.4 - 1.2; // scan line sweeping upward
      const size = Math.max(1, 1.15 * d);
      ctx.fillStyle = opts.current.color || getComputedStyle(c).getPropertyValue("--orb-particle").trim();

      for (const p of pts) {
        const x1 = p.x * cy - p.z * sy;
        const z1 = p.x * sy + p.z * cy;
        const y1 = p.y * ct - z1 * st;
        const z2 = p.y * st + z1 * ct;
        const k = 3.2 / (3.2 + z2);
        const depth = 0.18 + 0.7 * Math.min(1, Math.max(0, (0.7 - z2) / 1.4));
        const dy = p.y - scan;
        const band = Math.exp(-(dy * dy) / 0.003);
        ctx.globalAlpha = Math.min(1, depth + band * 0.9);
        const s = size * (1 + band * 0.8);
        ctx.fillRect(cx + x1 * S * k, cyy - y1 * S * k, s, s);
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
      ref={canvasRef}
      role="img"
      aria-label="A rotating chess king made of glowing particles"
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
