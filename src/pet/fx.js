// Sistema de partículas y objetos de escena (comida voladora, confeti, corazones, zzz...).
// Trabaja en coordenadas del mundo SVG y se actualiza desde el bucle del animador.

import { rand, pick, clamp, f1 } from './math.js';
import { FOODS, FOOD_DEFS } from './food.js';

const NS = 'http://www.w3.org/2000/svg';

const SYMBOLS = `
  <symbol id="fx-heart" viewBox="-12 -11 24 22" overflow="visible">
    <path d="M0 9C-6 4 -11 0.5 -11 -4.2C-11 -8 -7.8 -10 -5 -10C-2.6 -10 -0.9 -8.6 0 -6.8C0.9 -8.6 2.6 -10 5 -10C7.8 -10 11 -8 11 -4.2C11 0.5 6 4 0 9Z" fill="#ff5fa2"/>
    <path d="M-7 -6C-6 -8 -4 -8.4 -3 -8" stroke="#fff" stroke-opacity=".7" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </symbol>
  <symbol id="fx-spark" viewBox="-10 -10 20 20" overflow="visible">
    <path d="M0 -10C1 -3 3 -1 10 0C3 1 1 3 0 10C-1 3 -3 1 -10 0C-3 -1 -1 -3 0 -10Z" fill="#fff"/>
  </symbol>
  <symbol id="fx-star" viewBox="-10 -10 20 20" overflow="visible">
    <path d="M0 -9L2.6 -3L9 -2.6L4 1.6L5.6 8L0 4.6L-5.6 8L-4 1.6L-9 -2.6L-2.6 -3Z" fill="#ffd84d" stroke="#ffb01f" stroke-width="1" stroke-linejoin="round"/>
  </symbol>
  <symbol id="fx-note" viewBox="-8 -12 16 20" overflow="visible">
    <path d="M-2 5A3.4 2.8 -20 1 1 -2.2 4.6V-9L6 -11V2.6A3.4 2.8 -20 1 1 5.8 2.2V-6.6L-0.2 -5.2V4.8Z" fill="currentColor"/>
  </symbol>
  <symbol id="fx-coin" viewBox="-11 -11 22 22" overflow="visible">
    <circle r="10" fill="#ffc83a" stroke="#e59a12" stroke-width="1.6"/>
    <circle r="6.6" fill="none" stroke="#fff3b0" stroke-width="1.4"/>
    <path d="M-3 -5L-5 -1" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
  </symbol>
`;

export class FX {
  constructor(layer, defs) {
    this.layer = layer;
    this.parts = [];
    this.sprites = new Set();
    if (!document.getElementById('fx-heart')) {
      const d = document.createElementNS(NS, 'defs');
      d.innerHTML = SYMBOLS + FOOD_DEFS + FOODS.map((f) => `<symbol id="food-${f.id}" viewBox="-18 -20 36 36" overflow="visible">${f.svg}</symbol>`).join('');
      (defs || layer.ownerSVGElement).appendChild(d);
    }
    this.confettiColors = ['#ff5fa2', '#ffd84d', '#5fd4ff', '#8f6bff', '#5ff0b0', '#ff8a4d'];
  }

  _el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    this.layer.appendChild(e);
    return e;
  }

  _use(id, size, extra = {}) {
    return this._el('use', { href: `#${id}`, width: size, height: size, x: -size / 2, y: -size / 2, ...extra });
  }

  // Partícula genérica
  add(el, o) {
    const p = {
      el, x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, drag: o.drag ?? 0.6,
      rot: o.rot || 0, vr: o.vr || 0, s: o.s ?? 1, s1: o.s1 ?? o.s ?? 1, life: o.life || 1, age: 0,
      fadeIn: o.fadeIn ?? 0.1, wobble: o.wobble || 0, ph: Math.random() * 6.28, sx: o.sx ?? 1,
    };
    this.parts.push(p);
    this._apply(p, 0);
    return p;
  }

  _apply(p, u) {
    const s = p.s + (p.s1 - p.s) * u;
    const wob = p.wobble ? Math.sin(p.age * 5 + p.ph) * p.wobble : 0;
    p.el.setAttribute('transform', `translate(${f1(p.x + wob)} ${f1(p.y)}) rotate(${f1(p.rot)}) scale(${f1(s * p.sx)} ${f1(s)})`);
    const a = Math.min(1, p.age / p.fadeIn) * (u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1);
    p.el.setAttribute('opacity', f1(clamp(a, 0, 1)));
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      const u = p.age / p.life;
      if (u >= 1) { p.el.remove(); this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      this._apply(p, u);
    }
  }

  // ---- efectos de alto nivel ----
  hearts(x, y, n = 3) {
    for (let i = 0; i < n; i++) {
      this.add(this._use('fx-heart', 16), { x: x + rand(-14, 14), y: y + rand(-6, 6), vx: rand(-14, 14), vy: rand(-55, -35), drag: 0.8, s: 0.4, s1: rand(0.8, 1.1), life: rand(1.3, 1.8), wobble: 3, rot: rand(-15, 15) });
    }
  }

  sparkles(x, y, n = 6, spread = 30, color = '#fff') {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(20, 70);
      const el = this._use('fx-spark', 12, { fill: color });
      el.style.color = color;
      this.add(el, { x: x + Math.cos(a) * rand(0, spread * 0.4), y: y + Math.sin(a) * rand(0, spread * 0.4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.2, s: rand(0.5, 1.1), s1: 0.1, life: rand(0.6, 1.1), vr: rand(-120, 120) });
    }
  }

  stars(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.2, 1.2), sp = rand(60, 120);
      this.add(this._use('fx-star', 14), { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 160, drag: 0.8, s: rand(0.6, 1), s1: 0.3, life: rand(0.8, 1.2), vr: rand(-200, 200) });
    }
  }

  confetti(x, y, n = 36) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.3, 1.3), sp = rand(90, 220);
      const el = this._el('rect', { x: -3, y: -1.6, width: 6, height: 3.2, rx: 1, fill: pick(this.confettiColors) });
      this.add(el, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 220, drag: 1.4, life: rand(1.4, 2.2), vr: rand(-400, 400), sx: 1, wobble: 4, fadeIn: 0.02 });
    }
  }

  crumbs(x, y, color, n = 7) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), sp = rand(30, 80);
      const el = this._el('circle', { r: rand(1, 2.2), fill: color });
      this.add(el, { x: x + rand(-4, 4), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 260, drag: 0.5, life: rand(0.5, 0.8), fadeIn: 0.01 });
    }
  }

  notes(x, y, color) {
    const el = this._use('fx-note', 16);
    el.style.color = color;
    this.add(el, { x: x + rand(-6, 6), y, vx: rand(-25, 25), vy: rand(-50, -35), drag: 0.6, s: 0.5, s1: 1, life: 1.6, wobble: 5, rot: rand(-20, 20) });
  }

  zzz(x, y, color) {
    const el = this._el('text', { 'font-family': 'Fredoka, system-ui, sans-serif', 'font-weight': 700, 'font-size': 13, fill: color, 'text-anchor': 'middle' });
    el.textContent = 'z';
    this.add(el, { x, y, vx: rand(12, 22), vy: -26, drag: 0.3, s: 0.6, s1: 1.5, life: 2.4, wobble: 4 });
  }

  ring(x, y, color = '#fff', size = 1) {
    const el = this._el('circle', { r: 10, fill: 'none', stroke: color, 'stroke-width': 3 });
    this.add(el, { x, y, s: 0.3 * size, s1: 9 * size, life: 0.7, fadeIn: 0.01, drag: 0 });
  }

  bubble(x, y) {
    const el = this._el('circle', { r: rand(2, 4.5), fill: 'rgba(255,255,255,.18)', stroke: 'rgba(255,255,255,.75)', 'stroke-width': 0.8 });
    this.add(el, { x, y, vy: rand(-26, -16), drag: 0, life: rand(3, 4.5), wobble: 4, fadeIn: 0.6 });
  }

  ember(x, y, color) {
    const el = this._el('circle', { r: rand(1, 2.2), fill: color });
    this.add(el, { x, y, vx: rand(-6, 6), vy: rand(-30, -18), drag: 0, life: rand(2, 3.4), wobble: 3, fadeIn: 0.4 });
  }

  converge(cx, cy, color = '#fff') {
    const a = rand(0, Math.PI * 2), r = rand(90, 140);
    const el = this._use('fx-spark', 10);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    this.add(el, { x, y, vx: (cx - x) * 1.6, vy: (cy - y) * 1.6, drag: 0.2, s: rand(0.5, 1), s1: 0.2, life: 0.6, fadeIn: 0.15 });
    void color;
  }

  // Objeto controlado manualmente (la comida que vuela hasta la boca, una moneda...)
  sprite(symbolId, size = 30) {
    const el = this._use(symbolId, size);
    const sp = {
      el,
      set: (x, y, s = 1, rot = 0, op = 1) => {
        el.setAttribute('transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(${f1(s)})`);
        el.setAttribute('opacity', f1(op));
      },
      remove: () => { el.remove(); this.sprites.delete(sp); },
    };
    this.sprites.add(sp);
    return sp;
  }

  clearSprites() { for (const s of [...this.sprites]) s.remove(); }
}
