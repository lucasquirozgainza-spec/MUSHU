// Rig del personaje: construye el SVG por capas una sola vez y, en cada fotograma,
// deforma sus piezas a partir de un objeto `pose` (números). No contiene lógica de juego.

import {
  clamp, lerp, closedSpline, openSpline, ribbon, mixHex, mat, makeNoise, f1,
} from './math.js';
import {
  BODY_POINTS, BODY_BOTTOM, BODY_CENTER_X, FACE_ANCHOR, EYES, IRIS_R, LID_REF,
  BROWS, MOUTH, ARMS, LEGS, SHADOW,
} from './shapes.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export const DEFAULT_POSE = {
  // cuerpo
  x: 0, y: 0, feetY: 0, squash: 0, lean: 0, turn: 0, flipX: 1, breathe: 0,
  flameAmp: 1, flameSpeed: 1, flameDroop: 0, flameLift: 0,
  // ojos
  lookX: -0.75, lookY: 0.12,
  lidL: LID_REF, lidR: LID_REF, lidTilt: 0, lidArc: 0.04,
  lowerL: 0, lowerR: 0, lowerArc: 0.25,
  blink: 0, irisScale: 1, sparkle: 0,
  // cejas (positivo = hacia arriba, en px)
  browL_raise: 0, browL_inner: 0, browL_outer: 0, browL_arch: 0,
  browR_raise: 0, browR_inner: 0, browR_outer: 0, browR_arch: 0,
  // boca
  mouthCurve: -0.55, mouthOpen: 0, mouthWidth: 1, mouthAsym: 1, mouthHook: 1,
  mouthX: 0, mouthY: 0, tongue: 0, cheeks: 0,
  // otros
  blush: 0, tear: 0, glow: 0, whiteout: 0,
  // brazos (a1: hombro, a2: codo, hand: giro de mano, curl: dedos, front: delante del cuerpo)
  armL_a1: ARMS.L.rest.a1, armL_a2: ARMS.L.rest.a2, armL_hand: ARMS.L.rest.hand, armL_curl: ARMS.L.rest.curl, armL_front: 0,
  armR_a1: ARMS.R.rest.a1, armR_a2: ARMS.R.rest.a2, armR_hand: ARMS.R.rest.hand, armR_curl: ARMS.R.rest.curl, armR_front: 0,
  // piernas
  legL_lift: 0, legR_lift: 0, legL_dx: 0, legR_dx: 0,
};

export class PetRig {
  constructor(svg, palette) {
    this.svg = svg;
    this.id = `pet${++uid}`;
    this.bindings = [];
    this.palette = { ...palette };
    this.noise = Array.from({ length: 8 }, (_, i) => makeNoise(i * 7 + 3));
    this.flameLag = 0;
    // Proporciones de la etapa (alargamiento al crecer). 0 = forma de la referencia.
    this.form = { tall: 0, slim: 0, legs: 0, flame: 0, eyes: 1, arms: 0 };
    this._build();
    this.setPalette(palette);
  }

  // ---------- construcción ----------
  _bind(key, node, attr) {
    this.bindings.push([key, node, attr]);
  }

  _grad(defs, type, id, attrs, stops) {
    const g = el(type, { id: `${this.id}-${id}`, ...attrs }, defs);
    for (const [off, key, op = 1] of stops) {
      const s = el('stop', { offset: off, 'stop-opacity': op }, g);
      if (key.startsWith('#')) s.setAttribute('stop-color', key);
      else this._bind(key, s, 'stop-color');
    }
    return `url(#${this.id}-${id})`;
  }

  _build() {
    const svg = this.svg;
    const defs = el('defs', {}, svg);
    this.defs = defs;
    const G = {};
    G.body = this._grad(defs, 'linearGradient', 'body', { gradientUnits: 'userSpaceOnUse', x1: 0, y1: 28, x2: 0, y2: 250 }, [
      [0, 'bodyTop'], [0.14, 'bodyUpper'], [0.33, 'bodyMid'], [0.52, 'bodyMid2'], [0.67, 'bodyLower2'], [0.83, 'bodyLower'], [1, 'bodyBottom'],
    ]);
    G.hl = this._grad(defs, 'radialGradient', 'hl', { gradientUnits: 'userSpaceOnUse', cx: 150, cy: 102, r: 62 }, [
      [0, 'highlight', 0.62], [0.55, 'highlight', 0.22], [1, 'highlight', 0],
    ]);
    G.rim = this._grad(defs, 'radialGradient', 'rim', { gradientUnits: 'userSpaceOnUse', cx: 252, cy: 186, r: 62 }, [
      [0, 'rim', 0.95], [0.55, 'rim', 0.4], [1, 'rim', 0],
    ]);
    G.ao = this._grad(defs, 'radialGradient', 'ao', { gradientUnits: 'userSpaceOnUse', cx: 92, cy: 246, r: 78 }, [
      [0, 'ao', 0.3], [1, 'ao', 0],
    ]);
    G.lid = this._grad(defs, 'linearGradient', 'lid', { x1: 0, y1: 0, x2: 0, y2: 1 }, [
      [0, 'lidTop'], [1, 'lidBottom'],
    ]);
    G.lowLid = this._grad(defs, 'linearGradient', 'lowLid', { x1: 0, y1: 0, x2: 0, y2: 1 }, [
      [0, 'bodyMid2'], [1, 'bodyLower2'],
    ]);
    G.sclera = this._grad(defs, 'radialGradient', 'sclera', { cx: 0.5, cy: 0.62, r: 0.6 }, [
      [0, '#ffffff'], [0.8, '#fffaff'], [1, '#fff1fc'],
    ]);
    G.iris = this._grad(defs, 'linearGradient', 'iris', { x1: 0, y1: 0, x2: 0.15, y2: 1 }, [
      [0, 'irisDeep'], [0.42, 'irisDeep'], [1, 'iris'],
    ]);
    G.blush = this._grad(defs, 'radialGradient', 'blush', {}, [[0, 'blush', 0.85], [1, 'blush', 0]]);
    G.leg = this._grad(defs, 'linearGradient', 'leg', { gradientUnits: 'userSpaceOnUse', x1: 0, y1: 240, x2: 0, y2: 278 }, [
      [0, 'leg'], [1, 'legShade'],
    ]);
    G.shadow = this._grad(defs, 'radialGradient', 'shadow', {}, [[0, 'shadow', 0.42], [0.72, 'shadow', 0.34], [1, 'shadow', 0]]);
    G.faceGlow = this._grad(defs, 'radialGradient', 'faceGlow', {}, [[0, 'highlight', 0.62], [0.55, 'highlight', 0.3], [1, 'highlight', 0]]);
    G.tip = this._grad(defs, 'radialGradient', 'tip', {}, [[0, 'bodyTop', 0.95], [0.5, 'bodyTop', 0.55], [1, 'bodyTop', 0]]);
    G.glow = this._grad(defs, 'radialGradient', 'glowR', {}, [[0, '#ffffff', 0.95], [0.5, 'bodyTop', 0.5], [1, 'bodyTop', 0]]);

    const blur = el('filter', { id: `${this.id}-blur`, x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs);
    el('feGaussianBlur', { stdDeviation: 7 }, blur);

    // clip del cuerpo (se actualiza en cada fotograma)
    const clip = el('clipPath', { id: `${this.id}-bodyclip` }, defs);
    this.clipPath = el('path', {}, clip);

    const root = el('g', { class: 'pet-root' }, svg);
    this.root = root;

    // sombra en el suelo
    this.shadow = el('ellipse', { cx: SHADOW.cx, cy: SHADOW.cy, rx: SHADOW.rx, ry: SHADOW.ry, fill: G.shadow }, root);

    // piernas (en coordenadas del mundo, para que los pies se queden en el suelo)
    const legs = el('g', { class: 'legs' }, root);
    this.legsG = legs;
    this.legs = {};
    for (const side of ['L', 'R']) {
      this.legs[side] = {
        leg: el('path', { fill: G.leg }, legs),
        foot: el('path', { fill: G.leg }, legs),
      };
    }

    // cuerpo (todo lo que se deforma junto)
    const body = el('g', { class: 'body' }, root);
    this.bodyG = body;
    this.armsBack = el('g', { class: 'arms-back' }, body);
    this.glowBack = el('path', { fill: '#fff', filter: `url(#${this.id}-blur)`, opacity: 0 }, body);
    this.bodyPath = el('path', { fill: G.body }, body);

    const shading = el('g', { 'clip-path': `url(#${this.id}-bodyclip)` }, body);
    this.shading = shading;
    this.aoRect = el('rect', { x: 0, y: 0, width: 300, height: 300, fill: G.ao }, shading);
    this.rimRect = el('rect', { x: 0, y: 0, width: 320, height: 300, fill: G.rim }, shading);
    this.hlEl = el('ellipse', { cx: 150, cy: 102, rx: 64, ry: 52, fill: G.hl }, shading);
    this.faceGlow = el('ellipse', { cx: 112, cy: 146, rx: 40, ry: 36, fill: G.faceGlow }, shading);
    this.faceGlow2 = el('ellipse', { cx: 196, cy: 182, rx: 34, ry: 24, fill: G.faceGlow, opacity: 0.45 }, shading);
    // brillos en las puntas de las llamas (siguen a cada punta)
    this.tipGlows = ['L', 'M', 'R'].map(() => el('ellipse', { rx: 16, ry: 20, fill: G.tip }, shading));
    this.edge1 = el('path', { fill: 'none', 'stroke-width': 10, opacity: 0.05 }, shading);
    this.edge2 = el('path', { fill: 'none', 'stroke-width': 3, opacity: 0.06 }, shading);
    this._bind('edge', this.edge1, 'stroke');
    this._bind('edge', this.edge2, 'stroke');

    // rostro
    const face = el('g', { class: 'face' }, body);
    this.faceG = face;
    this.blushL = el('ellipse', { cx: 116, cy: 184, rx: 11, ry: 6, fill: G.blush, opacity: 0 }, face);
    this.blushR = el('ellipse', { cx: 204, cy: 183, rx: 11, ry: 6, fill: G.blush, opacity: 0 }, face);
    this.cheekL = el('ellipse', { cx: 135, cy: 193, rx: 0, ry: 0, opacity: 0.55, fill: '#fff' }, face);
    this.cheekR = el('ellipse', { cx: 175, cy: 194, rx: 0, ry: 0, opacity: 0.55, fill: '#fff' }, face);
    this._bind('highlight', this.cheekL, 'fill');
    this._bind('highlight', this.cheekR, 'fill');

    // pequeñas arrugas entre las cejas de la referencia
    const wr = el('g', { opacity: 0.28 }, face);
    this.wrinkles = wr;
    const dots = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const x = 151 + j * 2.6 + (i % 2) * 1.3, y = 121 + i * 3.2 - j * 1.2;
      if (x - 151 < (i + 1) * 2.4) dots.push([x, y]);
    }
    dots.forEach(([x, y]) => {
      const c = el('circle', { cx: x, cy: y, r: 0.7 }, wr);
      this._bind('highlight', c, 'fill');
    });

    this.eyes = {};
    for (const side of ['L', 'R']) this.eyes[side] = this._buildEye(face, side, G);

    this.brows = {
      L: el('path', {}, face),
      R: el('path', {}, face),
    };
    this._bind('brow', this.brows.L, 'fill');
    this._bind('brow', this.brows.R, 'fill');

    // boca
    const mouth = el('g', { class: 'mouth' }, face);
    const mclip = el('clipPath', { id: `${this.id}-mouthclip` }, defs);
    this.mouthClip = el('path', {}, mclip);
    this.mouthFill = el('path', { 'stroke-linejoin': 'round' }, mouth);
    this._bind('mouthIn', this.mouthFill, 'fill');
    this.tongue = el('ellipse', { 'clip-path': `url(#${this.id}-mouthclip)`, rx: 7, ry: 5 }, mouth);
    this._bind('tongue', this.tongue, 'fill');
    this.mouthLine = el('path', { fill: 'none', 'stroke-width': 3.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mouth);
    this.mouthHook = el('path', { fill: 'none', 'stroke-width': 2.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mouth);
    this._bind('mouth', this.mouthLine, 'stroke');
    this._bind('mouth', this.mouthHook, 'stroke');
    this._bind('mouth', this.mouthFill, 'stroke');

    // lágrima
    this.tearEl = el('path', { d: 'M0 -3.2C1.6 -0.6 2.6 1 2.6 2.3A2.6 2.6 0 0 1 -2.6 2.3C-2.6 1 -1.6 -0.6 0 -3.2Z', fill: '#bfefff', opacity: 0 }, face);

    // sockets para accesorios (gorros, gafas): heredan toda la deformación
    this.sockets = {
      head: el('g', { class: 'socket-head' }, body),
      face: el('g', { class: 'socket-face' }, face),
    };

    this.armsFront = el('g', { class: 'arms-front' }, body);
    this.arms = {};
    for (const side of ['L', 'R']) {
      const g = el('g', {}, this.armsBack);
      const shade = el('path', { opacity: 0.55 }, g);
      const arm = el('path', {}, g);
      const hand = el('path', {}, g);
      this._bind('armShade', shade, 'fill');
      this._bind('arm', arm, 'fill');
      this._bind('arm', hand, 'fill');
      this.arms[side] = { g, shade, arm, hand, front: false };
    }

    this.whiteoutEl = el('path', { fill: '#fff', opacity: 0 }, body);

    // capa de efectos (partículas): fuera del cuerpo
    this.fxLayer = el('g', { class: 'fx' }, svg);
  }

  _buildEye(face, side, G) {
    const E = EYES[side];
    const g = el('g', { class: `eye eye-${side}` }, face);
    // sombra de contacto bajo el globo ocular (profundidad)
    const contact = el('ellipse', { cx: E.cx - 0.6, cy: E.cy + 1.6, rx: E.rx + 0.8, ry: E.ry + 0.6, opacity: 0.06 }, g);
    this._bind('ao', contact, 'fill');
    const cid = `${this.id}-eye${side}`;
    const cp = el('clipPath', { id: cid }, this.defs);
    el('ellipse', { cx: E.cx, cy: E.cy, rx: E.rx, ry: E.ry }, cp);
    const inner = el('g', { 'clip-path': `url(#${cid})` }, g);
    el('ellipse', { cx: E.cx, cy: E.cy, rx: E.rx, ry: E.ry, fill: G.sclera }, inner);
    // sombra que proyecta el párpado sobre la esclerótica (el iris la tapa)
    const shadeA = el('path', { fill: 'none', 'stroke-width': 13, opacity: 0.22 }, inner);
    const shadeB = el('path', { fill: 'none', 'stroke-width': 6, opacity: 0.35 }, inner);
    this._bind('scleraShade', shadeA, 'stroke');
    this._bind('scleraShade', shadeB, 'stroke');
    const iris = el('g', {}, inner);
    // aro rosado visible como media luna en la parte inferior del iris
    const ring = el('circle', { cx: 0, cy: 0, r: IRIS_R }, iris);
    this._bind('irisRing', ring, 'fill');
    const irisBase = el('circle', { cx: -1.3, cy: -1.5, r: IRIS_R - 1.4, fill: G.iris }, iris);
    const pupil = el('circle', { cx: -0.9, cy: -2.4, r: 5.2, opacity: 0.35 }, iris);
    this._bind('irisDeep', pupil, 'fill');
    const hl1 = el('ellipse', { cx: 3.4, cy: -0.4, rx: 1.9, ry: 1.7, fill: '#fff', opacity: 0.8 }, iris);
    const hl2 = el('circle', { cx: -5.6, cy: 3.6, r: 0.9, fill: '#fff', opacity: 0.5 }, iris);
    const hl3 = el('circle', { cx: -1, cy: -4.5, r: 1.7, fill: '#fff', opacity: 0 }, iris);
    // sombra del párpado sobre el iris (oscurece la parte alta)
    const irisShade = el('path', { fill: 'none', 'stroke-width': 7, opacity: 0.35 }, inner);
    this._bind('irisDeep', irisShade, 'stroke');
    const lower = el('path', { fill: G.lowLid }, inner);
    const lid = el('path', { fill: G.lid }, inner);
    // brillo superior del párpado (volumen de bola)
    const domeHl = el('ellipse', { cx: E.cx - E.rx * 0.18, cy: E.cy - E.ry * 0.62, rx: E.rx * 0.62, ry: E.ry * 0.3, fill: '#fff', opacity: 0.1 }, inner);
    const domeRim = el('ellipse', { cx: E.cx, cy: E.cy, rx: E.rx - 0.3, ry: E.ry - 0.3, fill: 'none', 'stroke-width': 0.8, opacity: 0.07 }, g);
    this._bind('ao', domeRim, 'stroke');
    const lowerLine = el('path', { fill: 'none', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0 }, g);
    this._bind('eyeRim', lowerLine, 'stroke');
    const lidLine = el('path', { fill: 'none', 'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    this._bind('lidLine', lidLine, 'stroke');
    return { E, iris, irisBase, hl1, hl2, hl3, shadeA, shadeB, irisShade, lower, lid, lidLine, lowerLine };
  }

  // ---------- forma por etapa ----------
  setForm(f) { this.form = { ...this.form, ...f }; }
  mixForm(a, b, t) {
    const o = {};
    for (const k in b) o[k] = lerp(a[k] ?? 0, b[k], t);
    this.setForm(o);
  }

  // ---------- paleta ----------
  setPalette(p) {
    this.palette = { ...p };
    for (const [key, node, attr] of this.bindings) if (p[key]) node.setAttribute(attr, p[key]);
  }

  mixPalette(a, b, t) {
    const out = {};
    for (const k in a) out[k] = (a[k] && b[k] && a[k][0] === '#') ? mixHex(a[k], b[k], t) : (t < 0.5 ? a[k] : b[k]);
    this.setPalette(out);
    return out;
  }

  // ---------- render por fotograma ----------
  render(p, time, dt) {
    // Matriz del cuerpo: squash & stretch + inclinación alrededor de la base.
    const F = this.form;
    const sy = (1 + p.squash) * (1 + F.tall), sx = (1 - p.squash * 0.55) * p.flipX * (1 - F.slim);
    const piv = BODY_BOTTOM;
    let M = mat.translate(p.x, p.y - F.legs);
    M = mat.mul(M, mat.translate(piv[0], piv[1]));
    M = mat.mul(M, mat.rotate(p.lean));
    M = mat.mul(M, mat.scale(sx, sy));
    M = mat.mul(M, mat.translate(-piv[0], -piv[1]));
    this.M = M;
    this.bodyG.setAttribute('transform', mat.str(M));

    // Retardo secundario de la llama (sigue el movimiento con inercia)
    const vx = this._lastX === undefined ? 0 : (p.x - this._lastX) / Math.max(dt, 1e-3) + (p.lean - this._lastLean) / Math.max(dt, 1e-3) * 60;
    this._lastX = p.x; this._lastLean = p.lean;
    this.flameLag = lerp(this.flameLag, clamp(-vx * 0.05, -6, 6), 1 - Math.exp(-dt * 6));

    const d = this._bodyPath(p, time);
    this.bodyPath.setAttribute('d', d);
    this.clipPath.setAttribute('d', d);
    this.edge1.setAttribute('d', d);
    this.edge2.setAttribute('d', d);
    this.whiteoutEl.setAttribute('d', d);
    this.whiteoutEl.setAttribute('opacity', p.whiteout);
    const wf = p.whiteout > 0.01 ? `brightness(${f1(1 + p.whiteout * 2.5)}) saturate(${f1(1 - p.whiteout)})` : '';
    if (wf !== this._wf) { this._wf = wf; for (const g of [this.legsG, this.armsBack, this.armsFront]) g.style.filter = wf; }
    this.glowBack.setAttribute('d', d);
    this.glowBack.setAttribute('opacity', p.glow);
    this.glowBack.style.display = p.glow > 0.01 ? '' : 'none';

    // Paralaje: el rostro gira un poco y el brillo se desplaza al lado contrario (volumen 3D).
    const fx = p.turn * 7 + p.lookX * 1.4, fy = p.lookY * 1.2 - p.breathe * 0.6;
    // el rostro no se estira con el cuerpo: se compensa la escala de la etapa
    const ax = FACE_ANCHOR[0], ay = FACE_ANCHOR[1];
    const kx = F.eyes / (1 - F.slim), ky = F.eyes / (1 + F.tall);
    this.faceG.setAttribute('transform', `translate(${f1(fx + ax)} ${f1(fy + ay)}) scale(${f1(kx * 1000) / 1000} ${f1(ky * 1000) / 1000}) translate(${-ax} ${-ay})`);
    this.hlEl.setAttribute('transform', `translate(${f1(-p.turn * 6 - p.lookX * 1.5)} ${f1(-p.lookY)})`);
    this.rimRect.setAttribute('transform', `translate(${f1(-p.turn * 8)} 0)`);
    this.sockets.head.setAttribute('transform', `translate(${f1(this._headDx)} ${f1(this._headDy)})`);

    this._renderEyes(p);
    this._renderBrows(p);
    this._renderMouth(p);

    this.blushL.setAttribute('opacity', p.blush * 0.75);
    this.blushR.setAttribute('opacity', p.blush * 0.75);
    this.wrinkles.setAttribute('opacity', clamp(0.28 + (p.browR_raise - p.browL_raise) * 0.01, 0, 0.4) * clamp(1 - p.blush, 0.2, 1));
    const ck = p.cheeks;
    for (const [c, x] of [[this.cheekL, 133 + p.mouthX], [this.cheekR, 176 + p.mouthX]]) {
      c.setAttribute('cx', x); c.setAttribute('cy', 192 + p.mouthY);
      c.setAttribute('rx', ck * 6.5); c.setAttribute('ry', ck * 5);
      c.setAttribute('opacity', ck * 0.32);
    }
    const tr = p.tear;
    this.tearEl.setAttribute('opacity', tr > 0.02 ? Math.sin(Math.min(1, tr) * Math.PI) * 0.95 : 0);
    this.tearEl.setAttribute('transform', `translate(${f1(113 - tr * 2)} ${f1(178 + tr * 18)}) scale(${f1(0.8 + tr * 0.4)})`);

    this._renderArms(p);
    this._renderLegs(p);

    // sombra: se reduce al saltar
    const lift = clamp(-Math.min(p.y, p.feetY) / 40, 0, 0.7);
    const sc = 1 - lift;
    this.shadow.setAttribute('rx', SHADOW.rx * sc * (1 + p.squash * -0.3));
    this.shadow.setAttribute('ry', SHADOW.ry * sc);
    this.shadow.setAttribute('cx', SHADOW.cx + p.x);
    this.shadow.setAttribute('opacity', 1 - lift * 0.6);
  }

  _bodyPath(p, time) {
    const t = time * p.flameSpeed;
    const A = 3.1 * p.flameAmp;
    const n = this.noise;
    const droop = p.flameDroop, lift = p.flameLift, lag = this.flameLag;
    // desplazamiento de cada punta de llama (ruido suave + caída + inercia)
    const tip = {
      L: [A * n[0](t * 1.7) - droop * 5 + lag * 0.8, -A * 0.6 * (0.6 + 0.4 * n[1](t * 2.3)) + droop * 10 - lift * 6],
      M: [A * 1.25 * n[2](t * 1.4) + droop * 6 + lag, -A * 0.7 * (0.6 + 0.4 * n[3](t * 2.1)) + droop * 11 - lift * 8],
      R: [A * n[4](t * 1.9) + droop * 3 + lag * 0.8, -A * 0.6 * (0.6 + 0.4 * n[5](t * 2.5)) + droop * 10 - lift * 6],
      N: [A * 0.35 * n[2](t * 1.4), A * 0.35 * n[7](t * 1.3) + droop * 4 - lift * 2],
    };
    const sway = p.flameAmp * 1.4 * n[6](t * 0.6) + lag * 0.5;
    const br = p.breathe;
    const pts = [], tens = [];
    for (const bp of BODY_POINTS) {
      const [x, y] = bp.p;
      let dx = 0, dy = 0;
      if (bp.g) { const o = tip[bp.g]; dx = o[0] * bp.w; dy = o[1] * bp.w - this.form.flame * 9 * bp.w * (bp.g === 'N' ? 0.3 : bp.g === 'M' ? 1.2 : 1); }
      if (y < 200) dx += sway * Math.pow((200 - y) / 170, 1.5);
      const belly = clamp((y - 110) / 80, 0, 1) * clamp((262 - y) / 40, 0, 1);
      dx += (x - BODY_CENTER_X) * br * 0.016 * belly;
      dy -= br * 1.1 * clamp((250 - y) / 200, 0, 1);
      pts.push([x + dx, y + dy]);
      tens.push(bp.t ?? 1);
    }
    const tipIdx = this._tipIdx || (this._tipIdx = ['L', 'M', 'R'].map((g) => BODY_POINTS.findIndex((b) => b.g === g && b.w === 1)));
    tipIdx.forEach((idx, k) => {
      const [tx, ty] = pts[idx];
      const e = this.tipGlows[k];
      e.setAttribute('cx', f1(tx + (k === 1 ? -6 : 0))); e.setAttribute('cy', f1(ty + 12));
    });
    this._headDx = sway * 0.7 + tip.M[0] * 0.25;
    this._headDy = -br * 1 + droop * 3 - lift * 2;
    return closedSpline(pts, tens);
  }

  _renderEyes(p) {
    const blink = clamp(p.blink, 0, 1);
    const qb = (a, c, b, u) => (1 - u) * (1 - u) * a + 2 * u * (1 - u) * c + u * u * b;
    for (const side of ['L', 'R']) {
      const e = this.eyes[side];
      const { cx, cy, rx, ry } = e.E;
      const inside = (x, y, pad = 0) => ((x - cx) / (rx + pad)) ** 2 + ((y - cy) / (ry + pad)) ** 2 <= 1;
      let lid = side === 'L' ? p.lidL : p.lidR;
      let low = side === 'L' ? p.lowerL : p.lowerR;
      // Parpadeo: el párpado superior baja y el inferior sube hasta encontrarse.
      const meet = clamp(Math.max(0.7, lid + 0.06), 0, 0.95);
      lid = lerp(lid, meet, blink);
      low = lerp(low, 1 - meet + 0.02, blink);
      const arc = lerp(p.lidArc, p.lidArc - 0.05, blink);
      const lowArc = lerp(p.lowerArc * clamp(low * 6, 0, 1), -arc + 0.05, blink);

      const top = cy - ry;
      const yE = top + lid * 2 * ry;
      const tilt = p.lidTilt * 6; // positivo: sube el lado interior (tristeza)
      const yl = yE + (side === 'L' ? tilt : -tilt) * 0.5, yr = yE - (side === 'L' ? tilt : -tilt) * 0.5;
      const xl = cx - rx - 4, xr = cx + rx + 4;
      const ctrlY = (yl + yr) / 2 + arc * ry * 2;
      const lidEdge = `M${f1(xl)} ${f1(yl)}Q${f1(cx)} ${f1(ctrlY)} ${f1(xr)} ${f1(yr)}`;
      e.lid.setAttribute('d', `${lidEdge}L${f1(xr)} ${f1(top - 6)}L${f1(xl)} ${f1(top - 6)}Z`);
      e.shadeA.setAttribute('d', lidEdge);
      e.shadeB.setAttribute('d', lidEdge);
      e.irisShade.setAttribute('d', lidEdge);
      e.shadeA.setAttribute('opacity', 0.22 * (1 - blink));

      // Línea del párpado: dentro del ojo, con un pequeño rabillo exterior en el ojo izquierdo.
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const u = i / 18;
        const qx = qb(xl, cx, xr, u), y = qb(yl, ctrlY, yr, u);
        const tail = side === 'L' && qx < cx && inside(qx, y, 3.2);
        if (inside(qx, y, 0.2) || tail) pts.push([qx, y]);
      }
      e.lidLine.setAttribute('d', pts.length > 1 ? 'M' + pts.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L') : '');
      e.lidLine.setAttribute('stroke-width', lerp(3.4, 2.8, blink));

      // Párpado inferior
      const yB = cy + ry - low * 2 * ry;
      const lctrl = yB - lowArc * ry * 2;
      const lowEdge = `M${f1(xl)} ${f1(yB)}Q${f1(cx)} ${f1(lctrl)} ${f1(xr)} ${f1(yB)}`;
      e.lower.setAttribute('d', low > 0.005 || blink > 0.01 ? `${lowEdge}L${f1(xr)} ${f1(cy + ry + 6)}L${f1(xl)} ${f1(cy + ry + 6)}Z` : '');
      const lp = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        const qx = qb(xl, cx, xr, u), y = qb(yB, lctrl, yB, u);
        if (inside(qx, y)) lp.push([qx, y]);
      }
      e.lowerLine.setAttribute('d', lp.length > 1 ? 'M' + lp.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L') : '');
      e.lowerLine.setAttribute('opacity', clamp(low * 4, 0, 0.9) * (1 - blink));

      // Iris (el ojo derecho converge un poco más, como en la referencia)
      const bias = side === 'L' ? 0.75 : -2.75;
      let ix = p.lookX * 11 + bias, iy = p.lookY * 9;
      const mx = rx - IRIS_R * 0.62, my = ry - IRIS_R * 0.62;
      const dn = Math.hypot(ix / mx, iy / my);
      if (dn > 1) { ix /= dn; iy /= dn; }
      const s = p.irisScale;
      e.iris.setAttribute('transform', `translate(${f1(cx + ix)} ${f1(cy + iy + 1.2)}) scale(${f1(s)})`);
      e.hl1.setAttribute('rx', 1.9 + p.sparkle * 1.6);
      e.hl1.setAttribute('ry', 1.7 + p.sparkle * 1.4);
      e.hl3.setAttribute('opacity', p.sparkle * 0.95);
    }
  }

  _renderBrows(p) {
    for (const side of ['L', 'R']) {
      const B = BROWS[side];
      const raise = p[`brow${side}_raise`], inner = p[`brow${side}_inner`], outer = p[`brow${side}_outer`], arch = p[`brow${side}_arch`];
      const n = B.pts.length;
      const pts = B.pts.map(([x, y], i) => {
        const u = i / (n - 1);
        const wi = B.inner === 1 ? u : 1 - u;
        const dy = raise + inner * Math.pow(wi, 1.6) + outer * Math.pow(1 - wi, 1.6) + arch * Math.sin(Math.PI * u);
        return [x, y - dy];
      });
      this.brows[side].setAttribute('d', ribbon(pts, B.width, 20));
    }
  }

  _renderMouth(p) {
    const cx = MOUTH.cx + p.mouthX, cy = MOUTH.cy + p.mouthY;
    const half = MOUTH.halfW * p.mouthWidth * (1 + p.mouthOpen * 0.08);
    const c = p.mouthCurve, o = p.mouthOpen, a = p.mouthAsym;
    const Ly = cy - c * 3.2 - a * 2.25 - o * 1.5, Ry = cy - c * 3.2 + a * 2.25 - o * 1.5;
    const Lx = cx - half, Rx = cx + half;
    const cux = cx - a * 4.5, cuy = cy + c * 17.7 * (0.7 + 0.3 * p.mouthWidth) - o * 3;
    const clx = cx - a * 2, cly = cuy + o * 30 + Math.max(0, c) * o * 8;
    const upper = `M${f1(Lx)} ${f1(Ly)}Q${f1(cux)} ${f1(cuy)} ${f1(Rx)} ${f1(Ry)}`;
    if (o > 0.02) {
      const shape = `${upper}Q${f1(clx)} ${f1(cly)} ${f1(Lx)} ${f1(Ly)}Z`;
      this.mouthFill.setAttribute('d', shape);
      this.mouthFill.setAttribute('stroke-width', 2.2);
      this.mouthClip.setAttribute('d', shape);
      this.mouthFill.style.display = '';
      this.tongue.style.display = '';
      const lowY = 0.25 * Ly + 0.5 * cly + 0.25 * Ry;
      this.tongue.setAttribute('cx', f1(cx - a * 1.5));
      this.tongue.setAttribute('cy', f1(lowY - 1 + (1 - p.tongue) * 3));
      this.tongue.setAttribute('rx', f1(half * 0.55));
      this.tongue.setAttribute('ry', f1(3 + o * 4));
      this.mouthLine.setAttribute('d', '');
    } else {
      this.mouthFill.style.display = 'none';
      this.tongue.style.display = 'none';
      this.mouthLine.setAttribute('d', upper);
    }
    const h = p.mouthHook;
    if (h > 0.02) {
      this.mouthHook.setAttribute('d', `M${f1(Lx - 4.2)} ${f1(Ly - 6)}Q${f1(Lx + 1.2)} ${f1(Ly - 3.4)} ${f1(Lx + 1.4)} ${f1(Ly + 0.6)}L${f1(Lx + 1.2)} ${f1(Ly + 7.2)}`);
      this.mouthHook.setAttribute('opacity', h);
    } else this.mouthHook.setAttribute('d', '');
  }

  _renderArms(p) {
    const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    for (const side of ['L', 'R']) {
      const A = ARMS[side], s = A.side;
      const a1 = p[`arm${side}_a1`], a2 = p[`arm${side}_a2`], hand = p[`arm${side}_hand`], curl = p[`arm${side}_curl`];
      const S = [A.shoulder[0] - s * p.breathe * 0.6, A.shoulder[1] - p.breathe * 0.8];
      const grow = 1 + this.form.arms;
      const d1 = [s * Math.sin(a1), Math.cos(a1)];
      const E = [S[0] + d1[0] * A.len1 * grow, S[1] + d1[1] * A.len1 * grow];
      const t2 = a1 + a2;
      const d2 = [s * Math.sin(t2), Math.cos(t2)];
      const W = [E[0] + d2[0] * A.len2 * grow, E[1] + d2[1] * A.len2 * grow];
      // brazo con un ligero arco (estilo "manguera")
      const mid = [(S[0] + W[0]) / 2, (S[1] + W[1]) / 2];
      const Ec = [lerp(mid[0], E[0], 1.15), lerp(mid[1], E[1], 1.15)];
      const armD = ribbon([S, Ec, W], (u) => lerp(7.6, 6.9, u), 16);
      const arm = this.arms[side];
      arm.arm.setAttribute('d', armD);
      arm.shade.setAttribute('d', armD);
      arm.shade.setAttribute('transform', `translate(${f1(s * 0.6)} 0.5)`);
      // el brazo no se deforma con el estiramiento de la etapa (se compensa alrededor del hombro)
      const F = this.form;
      arm.g.setAttribute('transform', F.tall || F.slim
        ? `translate(${f1(S[0])} ${f1(S[1])}) scale(${f1(1000 / (1 - F.slim)) / 1000} ${f1(1000 / (1 + F.tall)) / 1000}) translate(${f1(-S[0])} ${f1(-S[1])})`
        : '');

      // Mano en forma de pinza, como en la referencia: el brazo se curva hacia el cuerpo
      // y continúa en un dedo largo inferior; un dedo más corto nace del lado interior
      // un poco más arriba y apunta en diagonal, dejando un hueco entre ambos.
      const inward = (ang) => rot(d2, s * ang);
      const off = hand - 1.45;            // giro de la mano respecto al reposo
      const pinch = (curl - 1) * 0.35;    // cierra o abre la pinza
      const lo1 = inward(0.38 + off), lo2 = inward(1.05 + off), lo3 = inward(1.5 + off);
      const L0 = [W[0] - d2[0] * 3, W[1] - d2[1] * 3];
      const L1 = [W[0] + lo1[0] * 5.5, W[1] + lo1[1] * 5.5];
      const L2 = [L1[0] + lo2[0] * 7, L1[1] + lo2[1] * 7];
      const L3 = [L2[0] + lo3[0] * 7.5, L2[1] + lo3[1] * 7.5];
      let handD = ribbon([L0, L1, L2, L3], (u) => lerp(6.9, 5.4, u), 18);
      const up1 = inward(0.85 + off + pinch), up2 = inward(1.22 + off + pinch);
      const side90 = inward(1.57);
      const B = [W[0] - d2[0] * 5.5 + side90[0] * 1.5, W[1] - d2[1] * 5.5 + side90[1] * 1.5];
      const U1 = [B[0] + up1[0] * 6, B[1] + up1[1] * 6];
      const U2 = [U1[0] + up2[0] * 6, U1[1] + up2[1] * 6];
      handD += ribbon([B, U1, U2], (u) => lerp(5.6, 4.6, u), 12);
      const palm = L1;
      arm.hand.setAttribute('d', handD);

      const wantFront = p[`arm${side}_front`] > 0.5;
      if (wantFront !== arm.front) {
        (wantFront ? this.armsFront : this.armsBack).appendChild(arm.g);
        arm.front = wantFront;
      }
      this[`hand${side}`] = palm; // posición local (útil para sostener objetos)
    }
  }

  _renderLegs(p) {
    for (const side of ['L', 'R']) {
      const Lg = LEGS[side];
      const hip = mat.apply(this.M, Lg.hip);
      const lift = p[`leg${side}_lift`];
      const fx = p.flipX;
      const ankle = [BODY_BOTTOM[0] + (Lg.ankle[0] - BODY_BOTTOM[0]) * fx + p.x + p[`leg${side}_dx`], Lg.ankle[1] + p.feetY - lift * 10];
      const rest = Math.hypot(Lg.ankle[0] - Lg.hip[0], Lg.ankle[1] - Lg.hip[1]) + this.form.legs;
      const dx = ankle[0] - hip[0], dy = ankle[1] - hip[1];
      const dist = Math.hypot(dx, dy) || 1;
      // rodilla elástica: si la pierna se comprime, se arquea hacia afuera
      const bend = Math.sqrt(Math.max(0, rest * rest - dist * dist)) * 0.5 * Lg.dir;
      const knee = [(hip[0] + ankle[0]) / 2 - (dy / dist) * bend, (hip[1] + ankle[1]) / 2 + (dx / dist) * bend];
      const legs = this.legs[side];
      legs.leg.setAttribute('d', ribbon([hip, knee, [ankle[0], ankle[1] + 4]], (u) => lerp(Lg.wHip, Lg.wAnkle, u), 12));
      // pie
      const dir = Lg.dir * Math.sign(fx || 1);
      const fs = Math.max(0.25, Math.abs(fx));
      const tilt = lift * 0.35 * dir;
      const local = Lg.foot;
      const tens = Lg.tens;
      const c = Math.cos(tilt), sn = Math.sin(tilt);
      const pts = local.map(([x, y]) => {
        const X = x * dir * fs, Y = y;
        return [ankle[0] + X * c - Y * sn, ankle[1] + X * sn + Y * c];
      });
      legs.foot.setAttribute('d', closedSpline(pts, tens));
    }
  }

  // Convierte un punto del mundo (svg) a coordenadas locales del cuerpo.
  toLocal(pt) {
    const m = this.M; const det = m[0] * m[3] - m[1] * m[2];
    const x = pt[0] - m[4], y = pt[1] - m[5];
    return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det];
  }
  toWorld(pt) { return mat.apply(this.M, pt); }
}

export { FACE_ANCHOR };
