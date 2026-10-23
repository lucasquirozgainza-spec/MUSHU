// Utilidades matemáticas compartidas por el rig y el animador.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const f1 = (n) => Math.round(n * 100) / 100;

export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

// Ruido 1D suave: suma de senoides con fases aleatorias (barato y sin costuras).
export function makeNoise(seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const waves = [
    [1.0, 0.5], [2.17, 0.28], [3.71, 0.14], [5.93, 0.08],
  ].map(([f, a]) => ({ f: f * (0.85 + rnd() * 0.3), a, p: rnd() * Math.PI * 2 }));
  const norm = waves.reduce((m, w) => m + w.a, 0);
  return (t) => waves.reduce((m, w) => m + Math.sin(t * w.f + w.p) * w.a, 0) / norm;
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Muelle críticamente amortiguado: acerca `cur` a `target` sin rebotes bruscos.
export function damp(cur, target, smoothing, dt) {
  return lerp(cur, target, 1 - Math.exp(-dt / Math.max(1e-4, smoothing)));
}

// Pista de fotogramas clave: [[t, valor, easing?], ...] → función(t)
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) {
        const u = (t - t0) / (t1 - t0 || 1);
        return lerp(v0, v1, (ease[e] || ease.inOut)(u));
      }
    }
    return keys[keys.length - 1][1];
  };
}

// Curva cardinal cerrada que pasa por todos los puntos.
// `tens[i]` escala la tangente de cada punto: valores bajos producen puntas (llamas).
export function closedSpline(pts, tens = []) {
  const n = pts.length;
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const t1 = (tens[i] ?? 1) / 6, t2 = (tens[(i + 1) % n] ?? 1) / 6;
    d += `C${f1(p1[0] + (p2[0] - p0[0]) * t1)} ${f1(p1[1] + (p2[1] - p0[1]) * t1)} ` +
      `${f1(p2[0] - (p3[0] - p1[0]) * t2)} ${f1(p2[1] - (p3[1] - p1[1]) * t2)} ` +
      `${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + 'Z';
}

// Curva abierta (Catmull-Rom) como path.
export function openSpline(pts) {
  const n = pts.length;
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}

// Muestrea una Catmull-Rom abierta en `count` puntos.
export function sampleOpen(pts, count) {
  const n = pts.length, out = [];
  for (let k = 0; k < count; k++) {
    const u = (k / (count - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(u)), t = u - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const t2 = t * t, t3 = t2 * t;
    const c = (a, b, c2, d2) =>
      0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d2) * t2 + (-a + 3 * b - 3 * c2 + d2) * t3);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

// Trazo de grosor variable (cejas, extremidades) con extremos redondeados.
export function ribbon(pts, widthAt, samples = 18) {
  const s = sampleOpen(pts, samples);
  const L = [], R = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const w = widthAt(i / (s.length - 1)) / 2;
    L.push([s[i][0] - dy * w, s[i][1] + dx * w]);
    R.push([s[i][0] + dy * w, s[i][1] - dx * w]);
  }
  const w0 = widthAt(0) / 2, w1 = widthAt(1) / 2;
  let d = `M${f1(L[0][0])} ${f1(L[0][1])}`;
  for (let i = 1; i < L.length; i++) d += `L${f1(L[i][0])} ${f1(L[i][1])}`;
  const e = R[R.length - 1];
  d += `A${f1(w1)} ${f1(w1)} 0 0 0 ${f1(e[0])} ${f1(e[1])}`;
  for (let i = R.length - 2; i >= 0; i--) d += `L${f1(R[i][0])} ${f1(R[i][1])}`;
  d += `A${f1(w0)} ${f1(w0)} 0 0 0 ${f1(L[0][0])} ${f1(L[0][1])}Z`;
  return d;
}

// Interpolación de colores hex.
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

// Matriz afín 2D [a b c d e f] (como SVG).
export const mat = {
  identity: () => [1, 0, 0, 1, 0, 0],
  mul: (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ],
  translate: (x, y) => [1, 0, 0, 1, x, y],
  scale: (x, y) => [x, 0, 0, y, 0, 0],
  rotate: (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0],
  apply: (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]],
  str: (m) => `matrix(${m.map((v) => f1(v * 1000) / 1000).join(' ')})`,
};
