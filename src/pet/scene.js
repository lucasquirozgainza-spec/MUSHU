// Objetos del entorno: cama, balón (con física, se puede patear) y juguetes de las
// actividades (libro, móvil, autito). Se dibujan en coordenadas del mundo de la escena.

import { clamp, lerp, f1 } from './math.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

const DEFS = `
  <radialGradient id="sc-ball" cx=".38" cy=".32" r=".72"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f1eef7"/><stop offset="1" stop-color="#c9c2d9"/></radialGradient>
  <linearGradient id="sc-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a55"/><stop offset="1" stop-color="#9a5f33"/></linearGradient>
  <linearGradient id="sc-blanket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7bb4ff"/><stop offset="1" stop-color="#4a7fe0"/></linearGradient>
  <linearGradient id="sc-car" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b5a"/><stop offset="1" stop-color="#d93a35"/></linearGradient>
`;

// Balón de fútbol con hexágonos (gira con la rotación).
const BALL = `
  <circle r="13" fill="url(#sc-ball)" stroke="#8d86a0" stroke-width="1"/>
  <path d="M0 -5 L4.8 -1.5 L3 4 L-3 4 L-4.8 -1.5 Z" fill="#2b2735"/>
  <path d="M0 -5 L0 -12.6 M4.8 -1.5 L11.8 -4.4 M3 4 L7.4 10.4 M-3 4 L-7.4 10.4 M-4.8 -1.5 L-11.8 -4.4" stroke="#2b2735" stroke-width="1.3"/>
  <path d="M-3.6 -12.4 L3.6 -12.4 L1.8 -13 Z M11 -7.6 L12.8 -1 Z" fill="#2b2735"/>
  <path d="M9.4 7 L12.4 2.4 L11.4 6.4 Z M-9.4 7 L-12.4 2.4 L-11.4 6.4 Z M-2.6 12.6 L2.6 12.6 L0 13 Z" fill="#2b2735"/>`;

export const PROPS = {
  book: `<g>
    <path d="M-22 -2 L0 2 L22 -2 L22 24 L0 28 L-22 24 Z" fill="#e5484d"/>
    <path d="M-20 -4 L0 0 L0 26 L-20 22 Z" fill="#fffaf2"/><path d="M20 -4 L0 0 L0 26 L20 22 Z" fill="#fff4e0"/>
    <path d="M-16 4 L-4 6 M-16 9 L-4 11 M-16 14 L-6 16 M4 6 L16 4 M4 11 L16 9 M4 16 L14 14" stroke="#b9a98a" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M0 0 V26" stroke="#d9c9a8" stroke-width="1.2"/></g>`,
  phone: `<g>
    <rect x="-11" y="-2" width="22" height="34" rx="4.5" fill="#2b2735"/>
    <rect x="-9" y="1" width="18" height="27" rx="2.4" fill="#5fd4ff"/>
    <rect x="-6" y="16" width="5" height="5" rx="1" fill="#ffd84d"/><rect x="2" y="10" width="5" height="5" rx="1" fill="#ff5fa2"/>
    <rect x="-4" y="5" width="4" height="4" rx="1" fill="#5ff0b0"/>
    <path d="M-9 24 H9" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/></g>`,
  car: `<g>
    <path d="M-24 4 C-24 -2 -18 -4 -12 -4 L-6 -14 C-4 -17 8 -17 11 -14 L17 -4 C22 -4 26 -2 26 4 L26 8 L-24 8 Z" fill="url(#sc-car)"/>
    <path d="M-4 -12 L9 -12 L13 -4 L-8 -4 Z" fill="#bfe8ff"/>
    <path d="M2.5 -12 V-4" stroke="#d93a35" stroke-width="1.6"/>
    <circle cx="-13" cy="9" r="6" fill="#2b2735"/><circle cx="-13" cy="9" r="2.4" fill="#c9c2d9"/>
    <circle cx="15" cy="9" r="6" fill="#2b2735"/><circle cx="15" cy="9" r="2.4" fill="#c9c2d9"/>
    <rect x="22" y="0" width="4" height="3" rx="1" fill="#fff3a6"/></g>`,
};

export class Scene {
  constructor(svg, rig) {
    this.svg = svg; this.rig = rig;
    const defs = el('defs', {}, svg); defs.innerHTML = DEFS;
    // capa trasera (cama) y delantera (balón, juguetes en el suelo)
    this.back = el('g', { class: 'scene-back' });
    svg.insertBefore(this.back, rig.root);
    this.front = el('g', { class: 'scene-front' });
    svg.insertBefore(this.front, rig.fxLayer);

    // cama
    this.bed = el('g', { class: 'bed', display: 'none' }, this.back);
    this.bed.innerHTML = `
      <ellipse cx="150" cy="292" rx="150" ry="10" fill="#000" opacity=".1"/>
      <rect x="10" y="150" width="20" height="142" rx="8" fill="url(#sc-wood)"/>
      <path d="M10 160 Q20 132 30 160" fill="#b97a47"/>
      <rect x="276" y="200" width="16" height="92" rx="7" fill="url(#sc-wood)"/>
      <rect x="18" y="246" width="268" height="34" rx="12" fill="#fffaf2"/>
      <rect x="18" y="270" width="268" height="14" rx="6" fill="url(#sc-wood)"/>
      <ellipse cx="74" cy="226" rx="46" ry="20" fill="#ffffff" stroke="#ebe3f2" stroke-width="2"/>
      <path d="M44 220 Q74 208 104 220" stroke="#ebe3f2" stroke-width="2" fill="none"/>`;
    this.blanket = el('path', { fill: 'url(#sc-blanket)', display: 'none' }, null);
    this.blanketG = el('g', { display: 'none' }, null);
    this.blanketG.appendChild(this.blanket);
    this.blanketG.insertAdjacentHTML('beforeend', '<g class="blanket-dots"></g>');
    svg.insertBefore(this.blanketG, rig.fxLayer);

    // balón
    this.ballG = el('g', { class: 'ball', style: 'cursor:pointer' }, this.front);
    this.ballShadow = el('ellipse', { rx: 12, ry: 3.4, fill: '#000', opacity: 0.14 }, this.ballG);
    this.ballSpin = el('g', {}, this.ballG);
    this.ballSpin.innerHTML = BALL;
    this.ball = { x: 268, y: 275, vx: 0, vy: 0, rot: 0, r: 13, ground: 275, visible: true, held: false };

    // juguete en el suelo (autito)
    this.toy = el('g', { display: 'none' }, this.front);
    this.toy.innerHTML = PROPS.car;
    this.toyPos = { x: 210, y: 268 };
    this._applyBall();
  }

  showBed(on) {
    this.bed.setAttribute('display', on ? 'inline' : 'none');
    this.blanketG.setAttribute('display', on ? 'inline' : 'none');
    this.bedOn = on;
  }

  kick(dir = 1, power = 1) {
    const b = this.ball;
    b.vx = dir * (150 + Math.random() * 90) * power;
    b.vy = -(180 + Math.random() * 110) * power;
  }

  hitBall(px, py) {
    const b = this.ball;
    return Math.hypot(px - b.x, py - (b.y - b.r)) < b.r + 10;
  }

  _applyBall() {
    const b = this.ball;
    const h = clamp((b.ground - b.y) / 120, 0, 1);
    this.ballShadow.setAttribute('cx', f1(b.x)); this.ballShadow.setAttribute('cy', f1(b.ground + 1));
    this.ballShadow.setAttribute('rx', f1(12 * (1 - h * 0.5))); this.ballShadow.setAttribute('opacity', f1(0.14 * (1 - h * 0.6)));
    this.ballSpin.setAttribute('transform', `translate(${f1(b.x)} ${f1(b.y - b.r)}) rotate(${f1(b.rot)})`);
  }

  update(dt, time, pose) {
    const b = this.ball;
    if (!b.held) {
      b.vy += 620 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > b.ground) { b.y = b.ground; b.vy = Math.abs(b.vy) > 60 ? -b.vy * 0.5 : 0; b.vx *= 0.82; }
      if (b.y >= b.ground) b.vx *= Math.exp(-dt * 1.6);
      const minX = -10, maxX = 312;
      if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx) * 0.6; }
      b.rot += (b.vx * dt / b.r) * 57.3;
    }
    this._applyBall();
    this.ballG.setAttribute('display', b.visible && !this.bedOn ? 'inline' : 'none');

    // manta: cubre el cuerpo tumbado y sube con la respiración
    if (this.bedOn) {
      const br = pose?.breathe ?? 0.5;
      const top = 196 - br * 3;
      this.blanket.setAttribute('d', `M170 ${f1(top + 18)} C176 ${f1(top + 2)} 196 ${f1(top - 6)} 230 ${f1(top - 4)} C262 ${f1(top - 2)} 284 ${f1(top + 12)} 288 ${f1(top + 34)} L288 272 L164 272 C160 ${f1(top + 52)} 164 ${f1(top + 30)} 170 ${f1(top + 18)} Z`);
      this.blanket.setAttribute('display', 'inline');
    }

    // autito
    if (this.toyMode) {
      const t = time * 1.4;
      const x = 205 + Math.sin(t) * 34;
      const dir = Math.cos(t) >= 0 ? 1 : -1;
      this.toy.setAttribute('transform', `translate(${f1(x)} ${f1(266 + Math.abs(Math.sin(t * 6)) * -1)}) scale(${dir} 1)`);
      this.toyX = x;
    }
  }

  setToy(on) { this.toyMode = on; this.toy.setAttribute('display', on ? 'inline' : 'none'); }
}

export { lerp };
