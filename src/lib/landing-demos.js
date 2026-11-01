export function initializeLandingDemos(root) {
  const timers = new Set();
  const frames = new Set();
  const cleanups = [];
  const setTimeout = (fn, ms) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const requestAnimationFrame = (fn) => { const id = window.requestAnimationFrame((now) => { frames.delete(id); fn(now); }); frames.add(id); return id; };
  const observe = (callback, options) => { const io = new IntersectionObserver(callback, options); cleanups.push(() => io.disconnect()); return io; };
  const listen = (el, event, callback) => { el.addEventListener(event, callback); cleanups.push(() => el.removeEventListener(event, callback)); };

/* ---------- Bayesian forecast demo (real grid posterior on simulated games) ---------- */
(function () {
  const svg = root.querySelector("#" + 'fc-chart');
  const NS = 'http://www.w3.org/2000/svg';
  const W = 800, H = 440, L = 64, R = 44, T = 20, B = 44;
  const X0 = 0, X1 = 16, Y0 = 1200, Y1 = 1950;
  const sx = (w) => L + (w - X0) / (X1 - X0) * (W - L - R);
  const sy = (r) => T + (1 - (r - Y0) / (Y1 - Y0)) * (H - T - B);
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; };

  // Axes
  for (let r = 1300; r <= 1900; r += 100) {
    el('line', { x1: L, x2: W - R, y1: sy(r), y2: sy(r), stroke: 'var(--landing-line)', 'stroke-width': 1 });
    const t = el('text', { x: L - 10, y: sy(r) + 5, 'text-anchor': 'end', fill: 'var(--landing-tertiary)', 'font-size': 14, 'font-family': 'Saira, sans-serif' }); t.textContent = r;
  }
  for (let w = 0; w <= 16; w += 4) {
    const t = el('text', { x: sx(w), y: H - 14, 'text-anchor': 'middle', fill: 'var(--landing-tertiary)', 'font-size': 14, 'font-family': 'Saira, sans-serif' }); t.textContent = 'Week ' + w;
  }
  const band = el('path', { fill: 'var(--demo-band)', stroke: 'none' });
  const medPast = el('path', { fill: 'none', stroke: 'var(--landing-accent)', 'stroke-width': 2.5 });
  const medFut = el('path', { fill: 'none', stroke: 'var(--landing-accent)', 'stroke-width': 2, 'stroke-dasharray': '6 6' });
  const today = el('line', { y1: T, y2: H - B, stroke: 'var(--landing-outline)', 'stroke-width': 1, 'stroke-dasharray': '2 4' });
  const dots = el('g', {});

  // Simulated player: true rating starts at 1450 and improves ~20 points a week.
  // Opponents are set near the player's level; results follow the Elo win probability
  // (low-discrepancy sampling, so the sample is representative rather than lucky or unlucky).
  const games = [];
  const offsets = [-150, 50, -50, 150, 0, -100, 100, -200, 200];
  for (let i = 0; i < 48; i++) {
    const wk = i / 4;
    const truth = 1450 + 20 * wk;
    const opp = Math.round((truth + offsets[i % offsets.length]) / 50) * 50;
    const p = 1 / (1 + Math.pow(10, (opp - truth) / 400));
    const u = (i * 0.6180339887 + 0.31) % 1;
    games.push({ wk, opp, s: u < p ? 1 : 0 });
  }

  // Grid posterior: rating(t) = r0 + slope * t
  const R0 = [], SL = [];
  for (let r = 1000; r <= 2000; r += 10) R0.push(r);
  for (let s = -30; s <= 40; s += 0.5) SL.push(s);
  const N = R0.length * SL.length;
  const logPrior = new Float64Array(N), cellR = new Float64Array(N), cellS = new Float64Array(N);
  let idx = 0;
  for (const r of R0) for (const s of SL) {
    cellR[idx] = r; cellS[idx] = s;
    logPrior[idx] = -0.5 * ((r - 1500) / 200) ** 2 - 0.5 * (s / 12) ** 2;
    idx++;
  }
  const TS = []; for (let w = 0; w <= 16; w += 0.5) TS.push(w);

  function posterior(n) {
    const lp = Float64Array.from(logPrior);
    for (let g = 0; g < n; g++) {
      const { wk, opp, s } = games[g];
      for (let i = 0; i < N; i++) {
        const p = 1 / (1 + Math.pow(10, (opp - (cellR[i] + cellS[i] * wk)) / 400));
        lp[i] += Math.log(s ? p : 1 - p);
      }
    }
    let mx = -Infinity; for (let i = 0; i < N; i++) if (lp[i] > mx) mx = lp[i];
    const w = new Float64Array(N); let sum = 0;
    for (let i = 0; i < N; i++) { w[i] = Math.exp(lp[i] - mx); sum += w[i]; }
    for (let i = 0; i < N; i++) w[i] /= sum;
    return w;
  }
  function quantiles(w, t, qs) {
    const vals = new Float64Array(N); const order = new Uint32Array(N);
    for (let i = 0; i < N; i++) { vals[i] = cellR[i] + cellS[i] * t; order[i] = i; }
    order.sort((a, b) => vals[a] - vals[b]);
    const out = []; let acc = 0, qi = 0;
    for (let k = 0; k < N && qi < qs.length; k++) {
      acc += w[order[k]];
      while (qi < qs.length && acc >= qs[qi]) { out.push(vals[order[k]]); qi++; }
    }
    while (out.length < qs.length) out.push(vals[order[N - 1]]);
    return out;
  }
  const pathOf = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const clampY = (r) => Math.max(Y0, Math.min(Y1, r));

  function draw(n) {
    const w = posterior(n);
    const now = n ? games[n - 1].wk : 0;
    const lo = [], hi = [], past = [], fut = [];
    for (const t of TS) {
      const [a, m, b] = quantiles(w, t, [0.1, 0.5, 0.9]);
      lo.push([sx(t), sy(clampY(a))]); hi.push([sx(t), sy(clampY(b))]);
      if (t <= now) past.push([sx(t), sy(clampY(m))]);
      if (t >= now) fut.push([sx(t), sy(clampY(m))]);
    }
    band.setAttribute('d', pathOf(lo.concat(hi.reverse())) + ' Z');
    medPast.setAttribute('d', past.length > 1 ? pathOf(past) : '');
    medFut.setAttribute('d', pathOf(fut));
    today.setAttribute('x1', sx(now)); today.setAttribute('x2', sx(now));
    while (dots.firstChild) dots.removeChild(dots.firstChild);
    for (let g = 0; g < n; g++) {
      const d = games[g];
      el('circle', { cx: sx(d.wk), cy: sy(d.opp), r: 4.5, fill: d.s ? 'var(--landing-accent)' : 'var(--landing-background)', stroke: d.s ? 'none' : 'var(--landing-tertiary)', 'stroke-width': 1.5 }, dots);
    }
    const [a, b] = quantiles(w, 16, [0.1, 0.9]);
    let pUp = 0; for (let i = 0; i < N; i++) if (cellS[i] > 0) pUp += w[i];
    root.querySelector("#" + 'fc-games').textContent = n;
    root.querySelector("#" + 'fc-range').textContent = Math.round(a / 10) * 10 + '–' + Math.round(b / 10) * 10;
    root.querySelector("#" + 'fc-prob').textContent = Math.round(pUp * 100) + '%';
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) { draw(games.length); return; }
  let n = 0;
  function step() {
    draw(n);
    if (n < games.length) { n++; setTimeout(step, 260); }
    else { setTimeout(() => { n = 0; step(); }, 4500); }
  }
  // Start when the section scrolls into view
  const io = observe((es) => { if (es[0].isIntersecting) { io.disconnect(); step(); } }, { threshold: 0.3 });
  draw(0); io.observe(svg);
})();

/* ---------- Skills radar demo ---------- */
(function () {
  const svg = root.querySelector("#" + 'rd-chart');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; };
  const axes = ['Opening play', 'Tactics', 'Positional play', 'Endgames', 'Defense', 'Consistency'];
  const states = [
    { v: [56, 40, 48, 44, 30, 36], u: 18, label: 'Week 1' },
    { v: [62, 64, 55, 53, 63, 61], u: 7, label: 'Week 8' }
  ];
  const cx = 350, cy = 262, Rmax = 175, n = axes.length;
  const pt = (i, val) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; const r = Rmax * Math.max(0, Math.min(100, val)) / 100; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const poly = (vals) => vals.map((v, i) => pt(i, v).map((c) => c.toFixed(1)).join(',')).join(' ');

  for (const ring of [25, 50, 75, 100]) el('polygon', { points: poly(Array(n).fill(ring)), fill: 'none', stroke: ring === 100 ? 'var(--landing-control)' : 'var(--landing-line)', 'stroke-width': 1 });
  const labels = [];
  axes.forEach((name, i) => {
    const [x, y] = pt(i, 100);
    el('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: 'var(--landing-line)', 'stroke-width': 1 });
    const [lx, ly] = pt(i, 118);
    const anchor = Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end';
    const t = el('text', { x: lx, y: ly + 5, 'text-anchor': anchor, fill: 'var(--landing-text)', 'font-size': 15, 'font-weight': 600, 'letter-spacing': '1.5', 'font-family': 'Saira, sans-serif' });
    t.textContent = name.toUpperCase();
    const v = el('text', { x: lx, y: ly + 24, 'text-anchor': anchor, fill: 'var(--landing-accent)', 'font-size': 15, 'font-family': 'Saira, sans-serif' });
    labels.push(v);
  });
  const outer = el('polygon', { fill: 'var(--demo-radar-outer)', stroke: 'var(--landing-accent)', 'stroke-opacity': 0.35, 'stroke-width': 1, 'stroke-dasharray': '3 4' });
  const main = el('polygon', { fill: 'var(--demo-radar-main)', stroke: 'var(--landing-accent)', 'stroke-width': 2 });
  const inner = el('polygon', { fill: 'none', stroke: 'var(--landing-accent)', 'stroke-opacity': 0.35, 'stroke-width': 1, 'stroke-dasharray': '3 4' });
  const pts = el('g', {});
  const marks = axes.map(() => el('circle', { r: 4, fill: 'var(--landing-accent)' }, pts));

  function render(k) {
    const v = states[0].v.map((a, i) => a + (states[1].v[i] - a) * k);
    const u = states[0].u + (states[1].u - states[0].u) * k;
    outer.setAttribute('points', poly(v.map((x) => x + u)));
    inner.setAttribute('points', poly(v.map((x) => x - u)));
    main.setAttribute('points', poly(v));
    v.forEach((x, i) => { const [px, py] = pt(i, x); marks[i].setAttribute('cx', px); marks[i].setAttribute('cy', py); labels[i].textContent = Math.round(x); });
    root.querySelector("#" + 'rd-week').textContent = k < 0.5 ? 'Week 1' : 'Week 8';
  }

  const buttons = root.querySelectorAll('.week-toggle button');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = still ? '1' : 'auto', k = still ? 1 : 0, target = k, t0 = performance.now(), raf = 0;
  const setPressed = () => buttons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.w === mode ? 'true' : 'false'));
  setPressed();
  function loop(now) {
    if (mode === 'auto') {
      const phase = ((now - t0) / 7000) % 1; // 7s cycle: grow, hold, shrink, hold
      const e = phase < 0.35 ? phase / 0.35 : phase < 0.5 ? 1 : phase < 0.85 ? 1 - (phase - 0.5) / 0.35 : 0;
      k = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
    } else {
      k += (target - k) * 0.12;
    }
    render(k);
    raf = requestAnimationFrame(loop);
  }
  buttons.forEach((b) => listen(b, 'click', () => {
    mode = b.dataset.w; setPressed();
    if (mode !== 'auto') target = Number(mode); else t0 = performance.now();
    if (still) { k = target; render(k); }
  }));
  render(k);
  if (!still) raf = requestAnimationFrame(loop);
})();


return () => { timers.forEach(window.clearTimeout); frames.forEach(window.cancelAnimationFrame); cleanups.forEach((fn) => fn()); };
}
