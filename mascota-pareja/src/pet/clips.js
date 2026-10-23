// Biblioteca de animaciones (clips). Cada clip devuelve, para un instante t, los parámetros
// de pose que quiere controlar; el animador los mezcla con el reposo usando su peso.
// Todas siguen anticipación → acción → asentamiento, y usan valores aleatorios por instancia
// (ctx.d) para que no se repitan de forma idéntica.

import { track, clamp, lerp, rand, pick } from './math.js';
import { FACE } from './expressions.js';
import { ARMS } from './shapes.js';

const K = (t, keys) => track(keys)(t);
const hop = (t, t0, t1, h) => (t > t0 && t < t1 ? -4 * h * ((t - t0) / (t1 - t0)) * (1 - (t - t0) / (t1 - t0)) : 0);
const RL = ARMS.L.rest, RR = ARMS.R.rest;
const armsRest = { armL_a1: RL.a1, armL_a2: RL.a2, armL_hand: RL.hand, armL_curl: RL.curl, armR_a1: RR.a1, armR_a2: RR.a2, armR_hand: RR.hand, armR_curl: RR.curl };
const armsUp = (k = 1, wave = 0) => ({
  armL_a1: lerp(RL.a1, 2.45, k) + wave, armL_a2: lerp(RL.a2, 0.15, k), armL_hand: lerp(RL.hand, 0.5, k),
  armR_a1: lerp(RR.a1, 2.45, k) - wave, armR_a2: lerp(RR.a2, 0.15, k), armR_hand: lerp(RR.hand, 0.5, k),
});
const mixPose = (a, b, k) => { const o = {}; for (const key in b) o[key] = lerp(a[key] ?? b[key], b[key], k); return o; };

export const CLIPS = {
  // ---------------- gestos de reposo (prioridad baja, interrumpibles) ----------------
  glance: {
    duration: 1.8, priority: 0, interruptible: true, fadeIn: 0.25, fadeOut: 0.4,
    init: () => ({ x: pick([-0.9, 0.85, 0.6, -0.4]), y: rand(-0.5, 0.3) }),
    sample: (t, c) => ({ lookX: c.d.x, lookY: c.d.y, turn: c.d.x * 0.35, browR_raise: K(t, [[0, 0], [0.3, 3], [1.4, 3], [1.8, 0]]) }),
  },
  browRaise: {
    duration: 1.5, priority: 0, interruptible: true, fadeIn: 0.15, fadeOut: 0.35,
    sample: (t) => ({
      browR_raise: K(t, [[0, 0], [0.18, 4.5, 'outBack'], [1.1, 4], [1.5, 0]]),
      browL_raise: K(t, [[0, 0], [0.2, -1.5], [1.2, -1.5], [1.5, 0]]),
      lidL: K(t, [[0, 0.405], [0.2, 0.47], [1.2, 0.47], [1.5, 0.405]]),
      lookX: -0.1, lookY: 0.05, turn: -0.15,
    }),
  },
  sigh: {
    duration: 2.1, priority: 0, interruptible: true, fadeIn: 0.3, fadeOut: 0.5,
    sample: (t) => ({
      squash: K(t, [[0, 0], [0.7, -0.045], [1.3, 0.04], [2.1, 0]]),
      breathe: K(t, [[0, 0.5], [0.7, 1], [1.4, 0], [2.1, 0.5]]),
      lidL: K(t, [[0, 0.405], [0.9, 0.55], [1.5, 0.55], [2.1, 0.405]]),
      lidR: K(t, [[0, 0.405], [0.9, 0.55], [1.5, 0.55], [2.1, 0.405]]),
      mouthCurve: K(t, [[0, -0.55], [0.7, -0.3], [1.2, -0.7], [2.1, -0.55]]),
      mouthOpen: K(t, [[0, 0], [0.8, 0], [1.05, 0.18], [1.5, 0]]),
      flameDroop: K(t, [[0, 0], [1.2, 0.4], [2.1, 0]]),
      armL_a1: K(t, [[0, RL.a1], [0.7, RL.a1 + 0.12], [1.4, RL.a1 - 0.05], [2.1, RL.a1]]),
      armR_a1: K(t, [[0, RR.a1], [0.7, RR.a1 + 0.12], [1.4, RR.a1 - 0.05], [2.1, RR.a1]]),
    }),
  },
  footTap: {
    duration: 1.9, priority: 0, interruptible: true, fadeIn: 0.2, fadeOut: 0.3,
    sample: (t) => ({
      legR_lift: Math.max(0, Math.sin(clamp((t - 0.2) / 1.4, 0, 1) * Math.PI * 4)) * 0.55,
      lean: -0.02 + Math.max(0, Math.sin(clamp((t - 0.2) / 1.4, 0, 1) * Math.PI * 4)) * 0.01,
      browL_inner: -2, browR_raise: -2, lookX: 0.6, lookY: -0.2, turn: 0.2,
    }),
  },
  shrug: {
    duration: 1.5, priority: 0, interruptible: true, fadeIn: 0.15, fadeOut: 0.35,
    sample: (t) => {
      const k = K(t, [[0, 0], [0.25, 1, 'outBack'], [0.9, 1], [1.5, 0]]);
      return {
        armL_a1: RL.a1 + 0.75 * k, armL_a2: RL.a2 + 0.7 * k, armL_hand: RL.hand - 1.2 * k, armL_curl: RL.curl - 0.6 * k,
        armR_a1: RR.a1 + 0.75 * k, armR_a2: RR.a2 + 0.7 * k, armR_hand: RR.hand - 1.2 * k, armR_curl: RR.curl - 0.6 * k,
        squash: -0.03 * k, browL_raise: 3 * k, browR_raise: 2 * k, mouthCurve: -0.55 - 0.2 * k, mouthAsym: 1 - 0.5 * k,
        lookX: -0.2, lookY: -0.1,
      };
    },
  },
  smirk: {
    duration: 1.7, priority: 0, interruptible: true, fadeIn: 0.2, fadeOut: 0.4,
    sample: (t) => {
      const k = K(t, [[0, 0], [0.3, 1], [1.2, 1], [1.7, 0]]);
      return { mouthCurve: lerp(-0.55, 0.35, k), mouthAsym: lerp(1, -1.4, k), mouthHook: 1 - k, browR_raise: 2 * k, lidL: 0.405 + 0.06 * k, lookX: 0.1, lookY: 0, turn: -0.1 * k };
    },
  },
  hop: {
    duration: 1.0, priority: 0, interruptible: true, fadeIn: 0.08, fadeOut: 0.2,
    sample: (t) => {
      const y = hop(t, 0.18, 0.62, 16);
      return {
        y, feetY: y, squash: K(t, [[0, 0], [0.16, 0.1], [0.24, -0.08], [0.6, -0.04], [0.68, 0.09], [0.85, -0.02], [1, 0]]),
        ...armsUp(K(t, [[0, 0], [0.25, 0.45], [0.6, 0.45], [0.8, 0]])), ...FACE.smile, mouthOpen: K(t, [[0, 0], [0.25, 0.35], [0.6, 0.35], [0.8, 0]]),
      };
    },
  },
  sway: {
    duration: 2.4, priority: 0, interruptible: true, fadeIn: 0.3, fadeOut: 0.4,
    sample: (t) => {
      const s = Math.sin(t * Math.PI * 1.6);
      return { lean: s * 0.07, x: s * 3, turn: s * 0.3, legL_lift: Math.max(0, -s) * 0.25, legR_lift: Math.max(0, s) * 0.25, ...FACE.happyClosed, lidArc: -0.18 };
    },
  },
  yawn: {
    duration: 2.6, priority: 0, interruptible: true, fadeIn: 0.25, fadeOut: 0.5,
    sample: (t) => {
      const o = K(t, [[0, 0], [0.5, 0.3], [1.0, 0.95], [1.7, 0.9], [2.2, 0]]);
      const st = K(t, [[0, 0], [0.8, 1], [1.7, 1], [2.3, 0]]);
      return {
        mouthOpen: o, mouthCurve: 0.05, mouthWidth: lerp(0.85, 0.55, o), mouthHook: 0, mouthAsym: 0,
        blink: K(t, [[0, 0], [0.7, 0.85], [1.8, 0.9], [2.4, 0]]), squash: -0.06 * st, y: -2 * st,
        browL_raise: 3 * o, browR_raise: -3 + 3 * o, ...armsUp(st * 0.85),
      };
    },
  },
  nod: {
    duration: 2.3, priority: 0, interruptible: true, fadeIn: 0.3, fadeOut: 0.3,
    sample: (t) => ({
      blink: K(t, [[0, 0], [0.9, 1], [1.4, 1], [1.5, 0.1], [2.3, 0]]),
      squash: K(t, [[0, 0], [1.2, 0.07], [1.45, -0.04, 'out'], [1.8, 0.01], [2.3, 0]]),
      lean: K(t, [[0, 0], [1.2, 0.06], [1.5, -0.02], [2.3, 0]]),
      flameDroop: K(t, [[0, 0], [1.2, 0.8], [1.5, 0], [2.3, 0]]),
      browL_raise: K(t, [[0, 0], [1.45, 0], [1.55, 4], [2.3, 0]]), browR_raise: K(t, [[0, -5], [1.45, -5], [1.55, 1], [2.3, -5]]),
    }),
  },
  rumble: {
    duration: 2.2, priority: 0, interruptible: true, fadeIn: 0.2, fadeOut: 0.4,
    sample: (t) => {
      const shake = t > 0.3 && t < 1.1 ? Math.sin(t * 70) * 1.4 : 0;
      const k = K(t, [[0, 0], [0.4, 1], [1.8, 1], [2.2, 0]]);
      return {
        x: shake, squash: shake * 0.008, lookX: 0.15, lookY: 0.9, turn: 0,
        armR_front: k > 0.5 ? 1 : 0, armR_a1: lerp(RR.a1, -0.55, k), armR_a2: lerp(RR.a2, -1.25, k), armR_hand: lerp(RR.hand, 0.4, k),
        mouthCurve: -0.6, mouthWidth: 0.6, mouthAsym: 0.8, browL_inner: 5, browR_inner: 4, browR_raise: -6,
      };
    },
  },
  lick: {
    duration: 1.6, priority: 0, interruptible: true, fadeIn: 0.15, fadeOut: 0.3,
    sample: (t) => ({
      mouthOpen: K(t, [[0, 0], [0.2, 0.28], [1.1, 0.28], [1.3, 0]]), tongue: 1, mouthCurve: 0.45, mouthWidth: 0.9,
      mouthX: K(t, [[0, 0], [0.4, -4], [0.75, 4], [1.1, 0]]), mouthHook: 0, mouthAsym: 0,
      lookX: K(t, [[0, 0.4], [0.4, -0.3], [0.8, 0.5], [1.2, 0.4]]), lookY: -0.3, sparkle: 0.6, browL_inner: 3,
    }),
  },
  sniffle: {
    duration: 2.4, priority: 0, interruptible: true, fadeIn: 0.2, fadeOut: 0.5,
    sample: (t) => ({
      squash: K(t, [[0, 0], [0.3, -0.03], [0.45, 0.02], [0.6, -0.03], [0.75, 0.02], [1, 0]]),
      blink: K(t, [[0, 0], [0.9, 0], [1.0, 1], [1.15, 0]]),
      tear: clamp((t - 0.8) / 1.4, 0, 1),
      mouthCurve: -1, mouthWidth: 0.7, lookY: 0.7,
    }),
  },
  lookDown: {
    duration: 2.2, priority: 0, interruptible: true, fadeIn: 0.4, fadeOut: 0.5,
    sample: (t) => ({ lookX: K(t, [[0, -0.5], [1.1, 0.3], [2.2, -0.2]]), lookY: 0.85, lean: Math.sin(t * 1.4) * 0.03, legR_lift: Math.max(0, Math.sin(t * 3)) * 0.15 }),
  },

  // ---------------- interacción ----------------
  poke: {
    duration: 1.45, priority: 2, interruptible: true, fadeIn: 0.03, fadeOut: 0.35,
    init: (c) => ({ dir: (c.opts.x ?? 150) < 150 ? -1 : 1, low: (c.opts.y ?? 150) > 190 }),
    sample: (t, c) => {
      const d = c.d.dir;
      const startle = K(t, [[0, 0], [0.05, 1, 'out'], [0.45, 1], [0.7, 0]]);
      const annoy = K(t, [[0, 0], [0.45, 0], [0.65, 1], [1.45, 1]]);
      return {
        squash: K(t, [[0, 0], [0.05, 0.13, 'out'], [0.16, -0.07], [0.3, 0.03], [0.45, 0]]),
        lean: K(t, [[0, 0], [0.06, -d * 0.12, 'out'], [0.22, d * 0.04], [0.45, 0], [1.45, 0]]),
        x: K(t, [[0, 0], [0.06, -d * 3], [0.3, 0]]),
        flameAmp: 1 + startle,
        lidL: lerp(lerp(0.405, 0.1, startle), 0.5, annoy), lidR: lerp(lerp(0.405, 0.1, startle), 0.5, annoy),
        irisScale: 1 - 0.1 * startle,
        browL_raise: 4 * startle - 2 * annoy, browL_inner: -4 * annoy, browR_raise: 2 * startle - 7 * annoy, browR_inner: -3 * annoy,
        mouthOpen: 0.4 * startle, mouthWidth: lerp(lerp(1, 0.42, startle), 0.8, annoy), mouthCurve: lerp(lerp(-0.55, 0, startle), -0.85, annoy),
        mouthHook: lerp(1, 0, startle), mouthAsym: lerp(1, 0, startle),
        lookX: d * 0.7, lookY: c.d.low ? 0.6 : -0.3, turn: d * 0.3 * annoy,
        armL_a1: RL.a1 + 0.6 * startle, armR_a1: RR.a1 + 0.6 * startle,
        armL_hand: RL.hand - 0.8 * startle, armR_hand: RR.hand - 0.8 * startle,
      };
    },
  },
  giggle: {
    duration: 2.3, priority: 2, interruptible: true, fadeIn: 0.1, fadeOut: 0.45,
    sample: (t) => {
      const b = Math.abs(Math.sin(t * 15)) * K(t, [[0, 1], [1.7, 1], [2.3, 0]]);
      const k = K(t, [[0, 0], [0.15, 1], [1.9, 1], [2.3, 0]]);
      return {
        y: -b * 3.5, squash: (b - 0.5) * 0.05, lean: Math.sin(t * 7.5) * 0.06, flameAmp: 1.6,
        ...FACE.happyClosed, ...FACE.laugh, mouthOpen: 0.45 + b * 0.2, blush: 0.75, ...FACE.browsHappy, browL_raise: 4, lookY: 0,
        armL_front: 1, armR_front: 1,
        armL_a1: lerp(RL.a1, -0.45, k), armL_a2: lerp(RL.a2, -1.4, k), armL_hand: lerp(RL.hand, 0.3, k),
        armR_a1: lerp(RR.a1, -0.45, k), armR_a2: lerp(RR.a2, -1.4, k), armR_hand: lerp(RR.hand, 0.3, k),
      };
    },
  },
  pet: {
    hold: true, priority: 2, interruptible: true, fadeIn: 0.35, fadeOut: 0.6,
    sample: (t, c) => {
      const lean = clamp((c.anim.petDX || 0) * 0.004, -0.09, 0.09);
      return {
        ...FACE.happyClosed, lidArc: -0.2, ...FACE.smile, mouthCurve: 0.6, mouthWidth: 0.85,
        ...FACE.browsHappy, browL_raise: 3, blush: 0.8 + Math.sin(t * 3) * 0.1,
        lean, turn: lean * 4, squash: 0.03 + Math.sin(t * 2.4) * 0.012, flameAmp: 0.75, flameSpeed: 0.8, flameLift: 0.15,
        armL_a1: RL.a1 + 0.12, armR_a1: RR.a1 + 0.12, armL_curl: 1.3, armR_curl: 1.3,
      };
    },
  },
  admire: {
    duration: 2.4, priority: 2, interruptible: true, fadeIn: 0.2, fadeOut: 0.45,
    sample: (t) => {
      const turn = Math.sin(t * 3.2) * K(t, [[0, 0], [0.6, 0.55], [1.8, 0.55], [2.4, 0]]);
      return {
        lookX: K(t, [[0, 0], [0.4, 0.2], [2.4, 0]]), lookY: K(t, [[0, 0], [0.35, -1], [1.0, -1], [1.4, 0.1]]),
        turn, lean: turn * 0.06, ...FACE.smile, mouthCurve: 0.7, mouthAsym: -0.6, sparkle: 0.8, irisScale: 1.08,
        browR_raise: -3, browL_raise: 2, blush: 0.4, squash: K(t, [[0, 0], [0.3, 0.06], [0.5, -0.05], [0.8, 0]]),
        y: hop(t, 0.32, 0.7, 7), feetY: hop(t, 0.32, 0.7, 7),
      };
    },
  },

  // ---------------- bañarse ----------------
  bath: {
    duration: 3.6, priority: 3, interruptible: false, fadeIn: 0.15, fadeOut: 0.45,
    sample: (t) => {
      const scrub = K(t, [[0, 0], [0.3, 1], [2.2, 1], [2.4, 0]]);
      const shake = t > 2.4 && t < 3.1 ? Math.sin((t - 2.4) * 38) : 0;
      return {
        ...FACE.happyClosed, lidArc: -0.18, ...FACE.smile, mouthCurve: 0.55 + 0.3 * scrub, mouthOpen: 0.25 * scrub, tongue: 0,
        browL_raise: 3, browR_raise: -5, blush: 0.5 * scrub,
        lean: Math.sin(t * 6) * 0.05 * scrub + shake * 0.08, x: shake * 3, squash: Math.sin(t * 12) * 0.02 * scrub + Math.abs(shake) * 0.03,
        flameAmp: 0.6 + Math.abs(shake) * 1.5, flameDroop: 0.4 * scrub,
        armL_front: scrub > 0.5 ? 1 : 0, armR_front: scrub > 0.5 ? 1 : 0,
        armL_a1: lerp(RL.a1, -0.3 + Math.sin(t * 9) * 0.25, scrub), armL_a2: lerp(RL.a2, -1.1, scrub),
        armR_a1: lerp(RR.a1, -0.3 + Math.cos(t * 9) * 0.25, scrub), armR_a2: lerp(RR.a2, -1.1, scrub),
      };
    },
    every: [[0.12, (c, t) => { if (t < 2.3) { const p = c.rig.toWorld([rand(80, 220), rand(120, 240)]); c.fx.bubble(p[0], p[1]); } }]],
    events: [[2.45, (c) => { const p = c.rig.toWorld([150, 150]); c.fx.sparkles(p[0], p[1], 10, 90, '#bfefff'); }]],
  },

  // ---------------- comer ----------------
  eat: {
    duration: 3.5, priority: 3, interruptible: false, fadeIn: 0.12, fadeOut: 0.45,
    init: (c) => {
      const food = c.opts.food;
      const sp = c.fx.sprite(`food-${food.id}`, 30);
      return { sp, food, chewSpeed: rand(15, 18), hop: food.rarity !== 'común' };
    },
    sample: (t, c) => {
      const notice = K(t, [[0, 0], [0.18, 1, 'outBack'], [0.55, 1], [0.7, 0]]);
      const open = K(t, [[0, 0], [0.5, 0.1], [0.82, 1], [0.95, 1], [1.0, 0]]);
      const chewK = K(t, [[0, 0], [0.98, 0], [1.05, 1], [2.35, 1], [2.45, 0]]);
      const chew = chewK * (0.5 + 0.5 * Math.sin((t - 1) * c.d.chewSpeed));
      const joy = K(t, [[0, 0], [1.0, 0], [1.3, 0.7], [2.4, 0.7], [2.7, 1], [3.5, 1]]);
      const gulp = K(t, [[0, 0], [2.4, 0], [2.52, 1], [2.68, 0]]);
      // trayectoria de la comida: aparece arriba a la derecha y entra en la boca
      const sp = c.d.sp;
      if (sp) {
        const mouthW = c.rig.toWorld([154 + c.pose.mouthX, 192]);
        const start = [c.rig.toWorld([0, 0])[0] + 262, 66];
        if (t < 0.55) {
          const a = clamp(t / 0.25, 0, 1);
          sp.set(start[0], start[1] + Math.sin(t * 9) * 2, 0.4 + 0.6 * a, Math.sin(t * 6) * 8, a);
        } else if (t < 0.95) {
          const u = (t - 0.55) / 0.4;
          const e = u * u * (3 - 2 * u);
          const x = lerp(start[0], mouthW[0], e), y = lerp(start[1], mouthW[1], e) - Math.sin(e * Math.PI) * 26;
          sp.set(x, y, lerp(1, 0.55, e), -e * 40, 1);
        } else {
          sp.remove(); c.d.sp = null;
        }
      }
      const toward = notice + open;
      return {
        lookX: lerp(0.85, 0.2, clamp(open * 1.4, 0, 1)) * (1 - chewK), lookY: lerp(-0.7, 0.3, clamp(open * 1.2, 0, 1)) * (1 - chewK),
        lidL: lerp(0.1, 0.405, open * 0.3), lidR: lerp(0.1, 0.405, open * 0.3),
        ...(chewK > 0 || joy > 0 ? { lidL: lerp(0.3, 0.6, joy), lidR: lerp(0.3, 0.6, joy), lowerL: 0.42 * joy, lowerR: 0.42 * joy, lidArc: lerp(0, -0.24, joy), lowerArc: 0.3 } : {}),
        irisScale: 1 + 0.08 * notice, sparkle: Math.max(notice, joy * 0.5),
        browL_raise: 4 * notice + 2 * joy, browR_raise: -1 * notice - 6 * joy, browL_inner: 1.5 * joy,
        mouthOpen: lerp(0.15 * notice + 0.9 * open, 0, 0) + chew * 0.12,
        mouthWidth: lerp(lerp(1, 0.7, notice), 0.78, open) * (1 - chewK) + chewK * 0.62 + joy * 0.25 * (1 - chewK),
        mouthCurve: lerp(0, 0.15, open) * (1 - chewK) + chewK * 0.35 + joy * 0.5 * (1 - chewK),
        mouthHook: 0, mouthAsym: 0, tongue: open,
        cheeks: chewK * (0.7 + chew * 0.3),
        lean: 0.05 * notice - 0.05 * open + Math.sin(t * c.d.chewSpeed * 0.5) * 0.015 * chewK,
        squash: K(t, [[0, 0], [0.7, 0.07], [0.95, -0.06, 'out'], [1.1, 0.04], [1.3, 0]]) + chew * 0.018 + gulp * 0.06,
        y: c.d.hop ? hop(t, 2.8, 3.25, 12) : 0, feetY: c.d.hop ? hop(t, 2.8, 3.25, 12) : 0,
        blush: 0.6 * joy, flameAmp: 1 + toward * 0.5 + joy * 0.4, flameLift: joy * 0.3,
        ...mixPose(armsRest, { armL_a1: RL.a1 + 0.55, armR_a1: RR.a1 + 0.55, armL_hand: RL.hand - 0.9, armR_hand: RR.hand - 0.9 }, notice + open * 0.6),
      };
    },
    events: [
      [0.04, (c) => c.fx.sparkles(c.rig.toWorld([0, 0])[0] + 262, 66, 5, 20)],
      [0.96, (c) => { const m = c.rig.toWorld([154, 194]); c.fx.crumbs(m[0], m[1], c.d.food.color, 8); c.anim.emit('consumed', c.opts); c.opts.onConsumed?.(); }],
      [2.75, (c) => { const m = c.rig.toWorld([150, 120]); c.fx.hearts(m[0], m[1], c.d.hop ? 4 : 2); }],
    ],
    end: (c) => c.d.sp?.remove(),
  },

  // ---------------- dormir ----------------
  fallAsleep: {
    duration: 3.2, priority: 3, interruptible: false, fadeIn: 0.3, fadeOut: 0.01, next: 'sleepLoop',
    sample: (t) => {
      const yawn = K(t, [[0, 0], [0.5, 0.4], [0.9, 0.95], [1.6, 0.9], [2.0, 0]]);
      const st = K(t, [[0, 0], [0.7, 1], [1.5, 1], [2.1, 0]]);
      const down = K(t, [[0, 0], [1.8, 0], [3.2, 1]]);
      return {
        mouthOpen: yawn + down * 0.12, mouthWidth: lerp(0.85, 0.5, yawn), mouthCurve: 0.05, mouthHook: 0, mouthAsym: 0,
        blink: K(t, [[0, 0], [0.6, 0.85], [1.7, 0.9], [2.0, 0.5], [2.6, 1], [3.2, 1]]),
        ...armsUp(st * 0.8), squash: -0.06 * st + 0.05 * down, lean: 0.05 * down, y: 0,
        flameAmp: lerp(1, 0.35, down), flameSpeed: lerp(1, 0.45, down), flameDroop: 0.4 * down,
        browL_raise: 2 * yawn - 2 * down, browR_raise: -2 - 4 * down, lookY: 0.3, breathe: K(t, [[0, 0.5], [0.8, 1], [2.0, 0.2], [3.2, 0.4]]),
      };
    },
  },
  sleepLoop: {
    loop: true, priority: 3, interruptible: false, fadeIn: 0.01, fadeOut: 0.3, state: 'sleeping',
    sample: (t, c) => {
      const br = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / 4.6));
      const petted = c.anim.sleepPet || 0;
      return {
        blink: 1, breathe: br, mouthOpen: 0.08 + br * 0.1, mouthWidth: 0.45, mouthCurve: 0.1 + petted * 0.5, mouthHook: 0, mouthAsym: 0,
        browL_raise: -2, browR_raise: -6, lidArc: -0.04 - petted * 0.15, blush: petted * 0.6,
        squash: 0.05 + br * 0.015, lean: 0.05 + Math.sin(t * 0.4) * 0.01, flameAmp: 0.35, flameSpeed: 0.45, flameDroop: 0.4,
        armL_a1: 0.18, armR_a1: 0.12, armL_curl: 1.2, armR_curl: 1.2,
      };
    },
    every: [[1.7, (c) => { const p = c.rig.toWorld([196, 118]); c.fx.zzz(p[0], p[1], c.rig.palette.accentInk); }]],
  },
  wakeUp: {
    duration: 2.8, priority: 3, interruptible: false, fadeIn: 0.05, fadeOut: 0.5,
    sample: (t) => {
      const st = K(t, [[0, 0], [0.9, 0], [1.3, 1, 'outBack'], [1.9, 1], [2.3, 0]]);
      const yawn = K(t, [[0, 0], [0.9, 0], [1.3, 0.85], [1.9, 0.8], [2.2, 0]]);
      return {
        blink: K(t, [[0, 1], [0.3, 1], [0.4, 0.5], [0.55, 1], [0.75, 0.3], [0.85, 0.7], [1.0, 0.2], [1.2, 0.9], [1.9, 0.9], [2.1, 0]]),
        ...armsUp(st), squash: K(t, [[0, 0.05], [0.9, 0.05], [1.3, -0.11], [1.9, -0.09], [2.2, 0.04], [2.5, 0]]),
        y: -3 * st, mouthOpen: yawn, mouthWidth: lerp(0.8, 0.5, yawn), mouthCurve: 0.05, mouthHook: 0, mouthAsym: 0,
        flameLift: st * 0.7, flameAmp: lerp(0.35, 1.6, K(t, [[0, 0], [1.1, 0], [1.5, 1], [2.8, 0.6]])),
        lean: Math.sin(t * 20) * 0.02 * K(t, [[0, 0], [2.2, 0], [2.4, 1], [2.8, 0]]),
        browL_raise: 3 * yawn, browR_raise: -4 + 3 * yawn,
      };
    },
  },
  wakeGrumpy: {
    duration: 1.9, priority: 3, interruptible: false, fadeIn: 0.02, fadeOut: 0.45,
    sample: (t) => {
      const startle = K(t, [[0, 1], [0.5, 1], [0.8, 0]]);
      const grr = K(t, [[0, 0], [0.6, 0], [0.85, 1], [1.9, 1]]);
      const y = hop(t, 0.02, 0.4, 14);
      return {
        y, feetY: y, squash: K(t, [[0, 0.05], [0.04, -0.1], [0.4, 0.1], [0.6, 0]]),
        lidL: lerp(0.06, 0.52, grr), lidR: lerp(0.06, 0.5, grr), irisScale: 1 - 0.12 * startle,
        ...armsUp(startle * 0.7), flameAmp: 1 + startle * 1.5, flameLift: startle * 0.6,
        mouthOpen: startle * 0.4, mouthWidth: lerp(0.42, 0.85, grr), mouthCurve: -0.9 * grr, mouthHook: grr, mouthAsym: grr,
        browL_raise: 5 * startle - 3 * grr, browL_inner: -4 * grr, browR_raise: 3 * startle - 8 * grr, browR_inner: -4 * grr,
        lookX: -0.1, lookY: 0,
      };
    },
  },

  // ---------------- jugar / bailar / celebrar ----------------
  play: {
    duration: 3.3, priority: 2, interruptible: true, fadeIn: 0.1, fadeOut: 0.45,
    sample: (t) => {
      const y = hop(t, 0.28, 0.72, 24) + hop(t, 0.95, 1.75, 44);
      const spin = t > 1.0 && t < 1.7 ? Math.cos(((t - 1.0) / 0.7) * Math.PI * 2) : 1;
      const up = K(t, [[0, 0], [0.3, 1], [0.7, 0.3], [0.95, 1], [1.75, 1], [2.1, 0.2], [3.3, 0]]);
      return {
        y, feetY: y, flipX: Math.abs(spin) < 0.12 ? (spin < 0 ? -0.12 : 0.12) : spin,
        squash: K(t, [[0, 0], [0.25, 0.12], [0.32, -0.1], [0.68, -0.05], [0.76, 0.13], [0.92, 0.12], [1.0, -0.12], [1.7, -0.05], [1.8, 0.15], [2.0, -0.04], [2.2, 0]]),
        ...armsUp(up, Math.sin(t * 10) * 0.15 * up),
        ...FACE.happyClosed, ...FACE.laugh, mouthOpen: 0.55, blush: 0.5, ...FACE.browsHappy,
        flameAmp: 1.7, flameLift: 0.4, legL_lift: up * 0.4 * (y < -2 ? 1 : 0), legR_lift: up * 0.25 * (y < -2 ? 1 : 0),
      };
    },
    events: [[0.74, (c) => { const p = c.rig.toWorld([150, 250]); c.fx.stars(p[0], p[1] + 15, 3); }], [1.8, (c) => { const p = c.rig.toWorld([150, 250]); c.fx.stars(p[0], p[1] + 15, 6); }]],
  },
  dance: {
    duration: 5.6, priority: 2, interruptible: true, fadeIn: 0.3, fadeOut: 0.5,
    sample: (t) => {
      const beat = 0.6;
      const ph = (t / beat) * Math.PI;
      const s = Math.sin(ph);
      const bounce = Math.abs(Math.cos(ph));
      const second = t > 2.8 ? 1 : 0;
      const wave = Math.sin(ph * 2);
      return {
        lean: s * 0.11, x: s * 6, turn: s * 0.45, squash: (1 - bounce) * 0.07 - 0.02, y: -bounce * 4,
        legL_lift: Math.max(0, s) * 0.55, legR_lift: Math.max(0, -s) * 0.55, legL_dx: s * 2, legR_dx: s * 2,
        armL_a1: second ? 2.3 + wave * 0.25 : 1.2 + Math.max(0, s) * 1.1, armL_a2: second ? 0.2 : -0.4 + wave * 0.5, armL_hand: 0.6,
        armR_a1: second ? 2.3 - wave * 0.25 : 1.2 + Math.max(0, -s) * 1.1, armR_a2: second ? 0.2 : -0.4 - wave * 0.5, armR_hand: 0.6,
        lidL: 0.5, lidR: 0.5, lowerL: 0.2, lowerR: 0.2, lidArc: -0.1, lowerArc: 0.3, ...FACE.smile, mouthCurve: 0.75,
        mouthOpen: second ? 0.3 : 0, ...FACE.browsHappy, browL_raise: 3 + bounce * 2, blush: 0.35, flameAmp: 1.5, flameLift: bounce * 0.3,
        lookX: s * 0.4, lookY: -0.1,
      };
    },
    every: [[0.6, (c) => { const p = c.rig.toWorld([pick([95, 210]), 90]); c.fx.notes(p[0], p[1], c.rig.palette.accent); }]],
  },
  celebrate: {
    duration: 3.0, priority: 2, interruptible: true, fadeIn: 0.08, fadeOut: 0.5,
    sample: (t) => {
      const y = hop(t, 0.32, 1.02, 46) + hop(t, 1.2, 1.5, 8);
      const up = K(t, [[0, 0], [0.3, -0.3], [0.4, 1, 'outBack'], [2.2, 1], [2.8, 0]]);
      const pump = t > 1.2 && t < 2.3 ? Math.sin((t - 1.2) * 11) * 0.35 : 0;
      return {
        y, feetY: y, squash: K(t, [[0, 0], [0.3, 0.14], [0.36, -0.13], [1.0, -0.05], [1.08, 0.14], [1.25, -0.03], [1.45, 0.06], [1.6, 0]]),
        ...armsUp(clamp(up, 0, 1)), armL_a2: 0.15 + pump, armR_a2: 0.15 - pump,
        ...FACE.wide, lidL: 0.12, lidR: 0.12, irisScale: 1.12, sparkle: 1,
        ...FACE.laugh, mouthOpen: 0.75, mouthWidth: 1.12, ...FACE.browsUp, browL_raise: 5, browR_raise: -1,
        blush: 0.6, flameAmp: 2, flameLift: 0.8, legL_lift: y < -5 ? 0.6 : 0, legR_lift: y < -5 ? 0.5 : 0,
      };
    },
    events: [[0.62, (c) => { const p = c.rig.toWorld([150, 80]); c.fx.confetti(p[0], p[1], 46); c.fx.sparkles(p[0], p[1] + 30, 8, 60); }]],
  },
  reward: {
    duration: 2.9, priority: 2, interruptible: true, fadeIn: 0.12, fadeOut: 0.5,
    init: (c) => ({ sp: c.fx.sprite('fx-coin', 22) }),
    sample: (t, c) => {
      const catchK = K(t, [[0, 0], [0.5, 0], [0.75, 1], [2.3, 1], [2.7, 0]]);
      const look = K(t, [[0, 0], [0.2, 1], [0.8, 1], [1.0, 0]]);
      const sp = c.d.sp;
      if (sp) {
        const hands = c.rig.toWorld([150, 205]);
        if (t < 0.8) { const u = t / 0.8; sp.set(hands[0], lerp(hands[1] - 150, hands[1], u * u), 1, u * 360, Math.min(1, u * 4)); }
        else if (t < 2.3) sp.set(hands[0], hands[1] + Math.sin(t * 6) * 1, 1, Math.sin(t * 5) * 10, 1);
        else if (t < 2.6) { const u = (t - 2.3) / 0.3; sp.set(hands[0], hands[1] - u * 10, 1 - u, 0, 1 - u); }
        else { sp.remove(); c.d.sp = null; }
      }
      return {
        lookX: 0, lookY: lerp(0.6, -1, look), irisScale: 1 + 0.08 * look, sparkle: 1,
        armL_front: catchK > 0.3 ? 1 : 0, armR_front: catchK > 0.3 ? 1 : 0,
        armL_a1: lerp(RL.a1, -0.35, catchK), armL_a2: lerp(RL.a2, -1.15, catchK), armL_hand: lerp(RL.hand, 0.4, catchK),
        armR_a1: lerp(RR.a1, -0.35, catchK), armR_a2: lerp(RR.a2, -1.15, catchK), armR_hand: lerp(RR.hand, 0.4, catchK),
        squash: K(t, [[0, 0], [0.7, 0], [0.8, 0.08], [1.0, -0.03], [1.2, 0]]),
        mouthCurve: lerp(0.2, 0.75, catchK), mouthOpen: look * 0.3, mouthAsym: -0.8 * catchK, mouthHook: 0, mouthWidth: 0.95,
        browR_raise: lerp(-1, 2, catchK), browL_raise: 2, blush: 0.5 * catchK, lidL: lerp(0.15, 0.35, catchK), lidR: lerp(0.15, 0.35, catchK),
        lean: Math.sin(t * 2.6) * 0.04 * catchK, turn: Math.sin(t * 2.6) * 0.2 * catchK,
      };
    },
    events: [[2.4, (c) => { const p = c.rig.toWorld([150, 200]); c.fx.sparkles(p[0], p[1], 8, 30, '#ffd84d'); }]],
    end: (c) => c.d.sp?.remove(),
  },
  recover: {
    duration: 2.4, priority: 1, interruptible: true, fadeIn: 0.2, fadeOut: 0.5,
    sample: (t) => {
      const shake = Math.sin(t * 28) * K(t, [[0, 0], [0.2, 1], [0.8, 0]]);
      const perk = K(t, [[0, 0], [0.8, 0], [1.2, 1, 'outBack'], [2.4, 1]]);
      const y = hop(t, 1.15, 1.55, 9);
      return {
        lean: shake * 0.06, x: shake * 2, blink: K(t, [[0, 0], [0.85, 0], [0.95, 1], [1.05, 0]]),
        y, feetY: y, squash: K(t, [[0, 0], [1.1, 0.07], [1.2, -0.06], [1.55, 0.05], [1.7, 0]]),
        mouthCurve: lerp(-0.6, 0.65, perk), mouthHook: 0, mouthAsym: 0.2, flameLift: perk * 0.5, flameAmp: 0.6 + perk * 0.8, flameDroop: 0.6 * (1 - perk),
        lidL: lerp(0.5, 0.28, perk), lidR: lerp(0.5, 0.26, perk), browL_inner: lerp(4, 1, perk), browR_inner: lerp(5, 0, perk), browR_raise: lerp(-8, -5, perk),
        ...armsUp(perk * 0.35), sparkle: perk * 0.5,
      };
    },
  },

  // ---------------- evolución ----------------
  evolve: {
    duration: 6.0, priority: 9, interruptible: false, fadeIn: 0.2, fadeOut: 0.6,
    sample: (t, c) => {
      const charge = K(t, [[0, 0], [1.6, 1, 'in'], [2.6, 1], [3.0, 0]]);
      const white = K(t, [[0, 0], [1.3, 0], [2.0, 1], [2.9, 1], [3.5, 0]]);
      const float = K(t, [[0, 0], [1.4, 1], [2.9, 1], [3.15, 0, 'in']]);
      const reveal = K(t, [[0, 0], [3.2, 0], [3.5, 1, 'outBack'], [5.2, 1], [6, 0]]);
      const jitter = Math.sin(t * 70) * 1.6 * charge;
      // mezcla de paleta durante el destello
      const mix = clamp((t - 2.05) / 0.6, 0, 1);
      c.opts.onMix?.(mix);
      return {
        x: jitter, y: -12 * float, feetY: -12 * float,
        squash: K(t, [[0, 0], [1.5, -0.04], [2.0, 0.08], [2.15, -0.1], [2.3, 0.06], [2.45, -0.06], [2.9, 0], [3.15, -0.06], [3.3, 0.12], [3.55, -0.05], [3.8, 0]]),
        glow: clamp(charge * 0.9 + white * 0.6, 0, 1) * (1 - reveal * 0.6), whiteout: white,
        blink: K(t, [[0, 0], [0.6, 1], [3.35, 1], [3.5, 0]]),
        flameAmp: 1 + charge * 1.6 + reveal * 0.6, flameLift: charge * 0.8 + reveal * 0.4,
        ...armsUp(clamp(charge * 0.6 + reveal, 0, 1)),
        ...FACE.laugh, mouthOpen: 0.6 * reveal, tongue: reveal,
        mouthCurve: lerp(-0.2, 0.95, reveal), mouthHook: 0, mouthAsym: 0, sparkle: reveal, irisScale: 1 + reveal * 0.1,
        lidL: lerp(0.4, 0.15, reveal), lidR: lerp(0.4, 0.15, reveal), browL_raise: 4 * reveal, browR_raise: -2 * reveal, blush: 0.5 * reveal,
        lookX: 0, lookY: -0.1 * reveal,
      };
    },
    every: [[0.07, (c, t) => { if (t > 0.3 && t < 2.0) { const p = c.rig.toWorld([150, 150]); c.fx.converge(p[0], p[1]); } }]],
    events: [
      [2.6, (c) => { const p = c.rig.toWorld([150, 150]); c.fx.ring(p[0], p[1], '#fff', 1.4); c.fx.ring(p[0], p[1], c.rig.palette.bodyTop, 1); c.fx.sparkles(p[0], p[1], 18, 80); }],
      [3.5, (c) => { const p = c.rig.toWorld([150, 70]); c.fx.confetti(p[0], p[1], 50); c.anim.emit('evolved', c.opts); }],
    ],
  },
};
