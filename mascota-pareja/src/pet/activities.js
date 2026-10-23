// Actividades propias (las hace solo, para que parezca que tiene vida) y la secuencia de
// irse a la cama. Se suman a CLIPS. Las actividades tienen prioridad baja: cualquier toque
// o cuidado las interrumpe, y al terminar recogen sus objetos.

import { track, clamp, lerp, rand } from './math.js';
import { FACE } from './expressions.js';
import { ARMS, LEGS } from './shapes.js';
import { PROPS } from './scene.js';

const K = (t, keys) => track(keys)(t);
const hop = (t, t0, t1, h) => (t > t0 && t < t1 ? -4 * h * ((t - t0) / (t1 - t0)) * (1 - (t - t0) / (t1 - t0)) : 0);
const RL = ARMS.L.rest, RR = ARMS.R.rest;
// brazos hacia delante sosteniendo algo frente al pecho
const hold = (k, lift = 0) => ({
  armL_front: k > 0.4 ? 1 : 0, armR_front: k > 0.4 ? 1 : 0,
  armL_a1: lerp(RL.a1, -0.42 - lift, k), armL_a2: lerp(RL.a2, -1.2 + lift * 0.3, k), armL_hand: lerp(RL.hand, 0.55, k), armL_curl: lerp(RL.curl, 0.6, k),
  armR_a1: lerp(RR.a1, -0.42 - lift, k), armR_a2: lerp(RR.a2, -1.2 + lift * 0.3, k), armR_hand: lerp(RR.hand, 0.55, k), armR_curl: lerp(RR.curl, 0.6, k),
});

export const ACTIVITY_NAMES = ['football', 'reading', 'phone', 'car'];
export const ACTIVITY_LABELS = { football: 'jugando al fútbol', reading: 'leyendo', phone: 'con el móvil', car: 'jugando con su autito' };

export const ACTIVITY_CLIPS = {
  // ---------------- fútbol: dominadas con el balón ----------------
  football: {
    duration: 24, priority: 1, interruptible: true, fadeIn: 0.4, fadeOut: 0.6, activity: true,
    init: (c) => {
      const b = c.scene?.ball;
      if (b) { b.held = true; b.visible = true; }
      return { from: b ? [b.x, b.y] : [260, 275], period: rand(0.82, 0.95) };
    },
    sample: (t, c) => {
      const b = c.scene?.ball;
      const P = c.d.period;
      const footX = LEGS.R.ankle[0] + c.pose.x + 34, ground = b ? b.ground : 275;
      const play = t > 0.8 && t < c.def.duration - 1.6;
      const n = Math.floor((t - 0.8) / P), u = ((t - 0.8) / P) % 1;
      const header = n % 5 === 4; // cada quinto toque, de cabeza
      const h = header ? 150 : 62;
      let bx = footX, by = ground - 6;
      if (t <= 0.8) { const e = t / 0.8; bx = lerp(c.d.from[0], footX, e); by = lerp(c.d.from[1], ground - 6, e) - Math.sin(e * Math.PI) * 30; }
      else if (play) { by = ground - 6 - Math.sin(u * Math.PI) * h; bx = footX + Math.sin(n * 1.7) * 3 - (header ? 26 * Math.sin(u * Math.PI) : 0); }
      if (b && b.held) { b.x = bx; b.y = by; b.rot += (header ? 9 : 6); }
      const height = clamp((ground - by) / 150, 0, 1);
      const kickLeg = play && !header ? Math.max(0, 1 - Math.min(u, 1 - u) * 6) : 0; // pierna sube cuando el balón baja
      const headHit = play && header ? Math.max(0, 1 - Math.abs(u - 0.5) * 5) : 0;
      return {
        lookX: clamp((bx - 160) / 70, -0.6, 0.9), lookY: lerp(0.9, -0.9, height), turn: 0.25,
        legR_lift: kickLeg * 0.9, lean: -0.03 * kickLeg + Math.sin(t * 1.3) * 0.02, squash: -0.05 * headHit + kickLeg * 0.02,
        y: -headHit * 6, feetY: 0,
        browL_raise: 2 + height * 4, browR_raise: -3 + height * 5, browL_inner: height * 1.5,
        mouthCurve: lerp(0.2, 0.6, height), mouthOpen: headHit * 0.35, mouthHook: 0, mouthAsym: 0.3, tongue: headHit,
        lidL: 0.22, lidR: 0.22, sparkle: 0.4,
        armL_a1: RL.a1 + 0.6 + kickLeg * 0.3, armL_a2: RL.a2 + 0.2, armR_a1: RR.a1 + 0.5 - kickLeg * 0.2, armR_a2: RR.a2 + 0.2,
        flameAmp: 1.3,
      };
    },
    events: [[23.0, (c) => { const b = c.scene?.ball; if (b) { b.held = false; c.scene.kick(1, 0.8); } }]],
    end: (c) => { const b = c.scene?.ball; if (b && b.held) { b.held = false; c.scene.kick(1, 0.4); } },
  },

  // ---------------- leyendo un libro ----------------
  reading: {
    duration: 30, priority: 1, interruptible: true, fadeIn: 0.5, fadeOut: 0.6, activity: true,
    init: (c) => { c.rig.setProp(PROPS.book, { scale: 1.55 }); return { laughAt: rand(9, 18), pageEvery: rand(6, 8) }; },
    sample: (t, c) => {
      const k = K(t, [[0, 0], [0.6, 1], [29, 1], [30, 0]]);
      const line = (t % 2.6) / 2.6; // los ojos recorren cada línea
      const page = (t % c.d.pageEvery) / c.d.pageEvery;
      const turning = page > 0.9 ? Math.sin((page - 0.9) / 0.1 * Math.PI) : 0;
      const laugh = K(t, [[0, 0], [c.d.laughAt, 0], [c.d.laughAt + 0.2, 1], [c.d.laughAt + 1.6, 1], [c.d.laughAt + 2, 0]]);
      const shake = laugh * Math.abs(Math.sin(t * 14));
      return {
        ...hold(k), propTilt: turning * -12, propLift: shake * 2,
        lookX: lerp(-0.45, 0.35, line < 0.85 ? line / 0.85 : 1 - (line - 0.85) / 0.15), lookY: 0.6, turn: 0,
        lidL: 0.42, lidR: 0.42,
        // las cejas acompañan lo que lee: sube una al pasar página, las dos al reír
        browL_raise: turning * 3 + laugh * 3 + Math.sin(t * 0.7) * 1.2, browR_raise: -2 + turning * 5 + laugh * 2,
        browL_inner: Math.max(0, Math.sin(t * 0.33)) * 2,
        mouthCurve: lerp(-0.1, 0.9, laugh), mouthOpen: laugh * 0.45, mouthHook: 0, mouthAsym: lerp(0.6, 0, laugh), tongue: laugh,
        y: -shake * 2, squash: shake * 0.02, blush: laugh * 0.4,
        ...(laugh > 0.5 ? FACE.happyClosed : {}),
        flameAmp: 0.8, lean: 0.02,
      };
    },
    end: (c) => c.rig.setProp(null),
  },

  // ---------------- con el móvil ----------------
  phone: {
    duration: 26, priority: 1, interruptible: true, fadeIn: 0.5, fadeOut: 0.6, activity: true,
    init: (c) => { c.rig.setProp(PROPS.phone, { scale: 1.3 }); return { winAt: rand(10, 18) }; },
    sample: (t, c) => {
      const k = K(t, [[0, 0], [0.6, 1], [25, 1], [26, 0]]);
      const tap = Math.max(0, Math.sin(t * 13)) * (Math.sin(t * 0.9) > -0.3 ? 1 : 0);
      const win = K(t, [[0, 0], [c.d.winAt, 0], [c.d.winAt + 0.15, 1, 'outBack'], [c.d.winAt + 1.8, 1], [c.d.winAt + 2.3, 0]]);
      const y = hop(t, c.d.winAt + 0.1, c.d.winAt + 0.55, 12);
      return {
        ...hold(k, 0.25), armR_a2: -0.95 - tap * 0.12, propLift: 4 + win * 6, propTilt: Math.sin(t * 0.8) * 4,
        lookX: Math.sin(t * 1.9) * 0.15, lookY: 0.45, lidL: lerp(0.38, 0.1, win), lidR: lerp(0.38, 0.1, win),
        irisScale: 1 + win * 0.1, sparkle: 0.5 + win * 0.5,
        browL_raise: 1 + win * 5 + Math.sin(t * 2.3) * 1.5, browR_raise: -3 + win * 6, browL_inner: (1 - win) * Math.max(0, Math.sin(t * 0.6)) * 3,
        mouthCurve: lerp(0, 0.95, win), mouthOpen: win * 0.6, mouthHook: 0, mouthAsym: lerp(0.8, 0, win), tongue: win,
        y, feetY: y, squash: K(t, [[0, 0], [c.d.winAt, 0], [c.d.winAt + 0.08, 0.08], [c.d.winAt + 0.2, -0.08], [c.d.winAt + 0.6, 0.06], [c.d.winAt + 0.8, 0]]),
        blush: 0.15, flameAmp: 0.9 + win, lean: -0.01,
      };
    },
    events: [[0.01, () => {}]],
    every: [[1, (c, t) => { if (Math.abs(t - c.d.winAt - 0.4) < 0.5) { const p = c.rig.toWorld([150, 110]); c.fx.stars(p[0], p[1], 4); } }]],
    end: (c) => c.rig.setProp(null),
  },

  // ---------------- jugando con su autito ----------------
  car: {
    duration: 26, priority: 1, interruptible: true, fadeIn: 0.5, fadeOut: 0.6, activity: true,
    init: (c) => { c.scene?.setToy(true); if (c.scene?.ball) c.scene.ball.visible = false; return {}; },
    sample: (t, c) => {
      const x = c.scene?.toyX ?? 205;
      const dir = Math.cos(t * 1.4);
      const turnBack = Math.max(0, 1 - Math.abs(dir) * 5); // cuando el auto da la vuelta
      const k = K(t, [[0, 0], [0.6, 1], [25, 1], [26, 0]]);
      return {
        squash: 0.07 * k, y: 4 * k, lean: 0.06 * k + (x - 205) * 0.0012,
        lookX: clamp((x - 150) / 70, -1, 1), lookY: 0.85, turn: clamp((x - 170) / 120, -0.4, 0.4),
        armR_front: k > 0.5 ? 1 : 0, armR_a1: lerp(RR.a1, 0.7, k), armR_a2: lerp(RR.a2, -0.6, k), armR_hand: 0.6,
        armL_a1: RL.a1 + 0.35 * k,
        browL_raise: 2 + turnBack * 4, browR_raise: -3 + turnBack * 5,
        mouthCurve: lerp(0.3, 0.9, turnBack), mouthOpen: turnBack * 0.45, mouthHook: 0, mouthAsym: 0.2, tongue: turnBack,
        lidL: 0.3, lidR: 0.3, sparkle: 0.5, flameAmp: 1.1 + turnBack * 0.6,
        legL_lift: 0, legR_lift: Math.max(0, Math.sin(t * 2.8)) * 0.2,
      };
    },
    every: [[2.24, (c) => { const p = [c.scene?.toyX ?? 205, 255]; c.fx.sparkles(p[0], p[1], 3, 14, '#fff3a6'); }]],
    end: (c) => { c.scene?.setToy(false); if (c.scene?.ball) c.scene.ball.visible = true; },
  },

  // ---------------- ¡lo pillaste! ----------------
  // Al abrir la app mientras hace algo: se sobresalta, suelta lo que tenía y luego sonríe
  // un poco avergonzado y saluda.
  caught: {
    duration: 3.2, priority: 2, interruptible: true, fadeIn: 0.04, fadeOut: 0.5,
    sample: (t) => {
      const jump = hop(t, 0.02, 0.42, 20);
      const startle = K(t, [[0, 0], [0.06, 1, 'out'], [0.9, 1], [1.3, 0]]);
      const shy = K(t, [[0, 0], [1.0, 0], [1.4, 1], [3.2, 1]]);
      const wave = shy * Math.sin(t * 11);
      return {
        y: jump, feetY: jump,
        squash: K(t, [[0, 0], [0.03, -0.12], [0.42, 0.1], [0.6, -0.03], [0.8, 0]]),
        flameAmp: 1 + startle * 1.8, flameLift: startle * 0.8,
        lidL: lerp(lerp(0.405, 0.04, startle), 0.36, shy), lidR: lerp(lerp(0.405, 0.04, startle), 0.36, shy),
        irisScale: 1 - 0.18 * startle, lookX: lerp(0.9, 0, shy), lookY: lerp(-0.2, 0.05, shy), turn: 0.3 * (1 - shy),
        browL_raise: 7 * startle + 3 * shy, browR_raise: 4 * startle - 1 * shy, browL_inner: 3 * shy, browR_inner: 2 * shy,
        mouthOpen: 0.7 * startle, mouthWidth: lerp(lerp(1, 0.4, startle), 0.85, shy), mouthCurve: lerp(0, 0.7, shy), mouthHook: 0, mouthAsym: lerp(0, -0.8, shy), tongue: 0,
        blush: 0.85 * shy,
        armL_a1: RL.a1 + 1.1 * startle, armL_a2: RL.a2 + 0.6 * startle, armL_hand: RL.hand - 1.2 * startle,
        armR_a1: lerp(RR.a1 + 1.1 * startle, 2.5, shy), armR_a2: lerp(RR.a2 + 0.6 * startle, 0.35 + wave * 0.35, shy), armR_hand: lerp(RR.hand - 1.2 * startle, 0.4, shy), armR_curl: lerp(RR.curl, 0.2, shy),
      };
    },
    events: [[0.08, (c) => { const p = c.rig.toWorld([196, 70]); c.fx.sparkles(p[0], p[1], 5, 16); }]],
  },

  // ---------------- a la cama ----------------
  goToBed: {
    duration: 3.4, priority: 3, interruptible: false, fadeIn: 0.2, fadeOut: 0.01, next: 'bedLoop',
    init: (c) => { c.scene?.showBed(true); return {}; },
    sample: (t) => {
      const yawn = K(t, [[0, 0], [0.4, 0.4], [0.8, 0.95], [1.5, 0.9], [1.9, 0]]);
      const st = K(t, [[0, 0], [0.6, 1], [1.4, 1], [1.9, 0]]);
      const lie = K(t, [[0, 0], [1.9, 0], [3.0, 1, 'inOut'], [3.4, 1]]);
      return {
        lie, mouthOpen: yawn, mouthWidth: lerp(0.85, 0.5, yawn), mouthCurve: 0.05, mouthHook: 0, mouthAsym: 0,
        blink: K(t, [[0, 0], [0.6, 0.85], [1.6, 0.9], [1.9, 0.4], [2.8, 1], [3.4, 1]]),
        armL_a1: lerp(RL.a1, 2.3, st), armL_a2: lerp(RL.a2, 0.1, st), armR_a1: lerp(RR.a1, 2.3, st), armR_a2: lerp(RR.a2, 0.1, st),
        squash: -0.06 * st, browL_raise: 3 * yawn - 2 * lie, browR_raise: -2 + 2 * yawn - 4 * lie,
        flameAmp: lerp(1, 0.4, lie), flameSpeed: lerp(1, 0.5, lie), flameDroop: 0.35 * lie, lookY: 0.2,
      };
    },
  },
  bedLoop: {
    loop: true, priority: 3, interruptible: false, fadeIn: 0.01, fadeOut: 0.3, state: 'sleeping', sleep: true,
    init: (c) => { c.scene?.showBed(true); return {}; },
    sample: (t, c) => {
      const br = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / 4.8));
      const petted = c.anim.sleepPet || 0;
      const dream = K((t % 23), [[0, 0], [15, 0], [15.6, 1], [18, 1], [18.6, 0]]); // a veces sonríe soñando
      return {
        lie: 1, blink: 1, breathe: br, mouthOpen: 0.06 + br * 0.08 * (1 - dream), mouthWidth: lerp(0.45, 0.8, dream), mouthCurve: 0.1 + dream * 0.6 + petted * 0.5,
        mouthHook: 0, mouthAsym: 0, lidArc: -0.04 - petted * 0.15 - dream * 0.1, blush: petted * 0.6 + dream * 0.3,
        browL_raise: -2 + dream * 2.5, browR_raise: -6 + dream * 3, browL_inner: dream * 1.5,
        squash: br * 0.015, flameAmp: 0.35, flameSpeed: 0.45, flameDroop: 0.35,
        armL_a1: 0.05, armR_a1: 0.02, armL_a2: -0.2, armR_a2: -0.2, armL_curl: 1.2, armR_curl: 1.2,
      };
    },
    every: [[1.8, (c) => c.fx.zzz(rand(60, 80), 150, c.rig.palette.accentInk)]],
  },
  wakeFromBed: {
    duration: 3.0, priority: 3, interruptible: false, fadeIn: 0.05, fadeOut: 0.5,
    init: (c) => { c.scene?.showBed(true); return {}; },
    sample: (t) => {
      const lie = K(t, [[0, 1], [0.6, 1], [1.5, 0, 'inOut']]);
      const st = K(t, [[0, 0], [1.4, 0], [1.8, 1, 'outBack'], [2.3, 1], [2.7, 0]]);
      const yawn = K(t, [[0, 0], [1.4, 0], [1.8, 0.85], [2.3, 0.8], [2.6, 0]]);
      return {
        lie,
        blink: K(t, [[0, 1], [0.3, 1], [0.4, 0.5], [0.55, 1], [0.75, 0.3], [0.85, 0.8], [1.0, 0.2], [1.6, 0.9], [2.3, 0.9], [2.5, 0]]),
        armL_a1: lerp(RL.a1, 2.4, st), armL_a2: lerp(RL.a2, 0.12, st), armR_a1: lerp(RR.a1, 2.4, st), armR_a2: lerp(RR.a2, 0.12, st),
        squash: -0.1 * st, y: -3 * st, mouthOpen: yawn, mouthWidth: lerp(0.8, 0.5, yawn), mouthCurve: 0.05, mouthHook: 0, mouthAsym: 0,
        browL_raise: 3 * yawn + 2 * st, browR_raise: -4 + 4 * yawn,
        flameLift: st * 0.7, flameAmp: lerp(0.35, 1.5, K(t, [[0, 0], [1.4, 0], [1.9, 1], [3, 0.7]])),
      };
    },
    events: [[1.6, (c) => c.scene?.showBed(false)]],
    end: (c) => c.scene?.showBed(false),
  },
  // Si lo tocan mientras duerme: se mueve un poco y sigue durmiendo
  stir: {
    duration: 1.6, priority: 4, interruptible: false, fadeIn: 0.05, fadeOut: 0.01, next: 'bedLoop',
    sample: (t) => ({
      lie: 1, blink: K(t, [[0, 1], [0.35, 1], [0.45, 0.75], [0.7, 0.75], [0.85, 1]]), breathe: 0.5,
      browL_raise: K(t, [[0, -2], [0.4, 2], [0.9, -3], [1.6, -2]]), browL_inner: K(t, [[0, 0], [0.5, -3], [1.2, -3], [1.6, 0]]),
      browR_raise: K(t, [[0, -6], [0.4, -2], [0.9, -8], [1.6, -6]]), browR_inner: K(t, [[0, 0], [0.5, -3], [1.2, -3], [1.6, 0]]),
      mouthCurve: K(t, [[0, 0.1], [0.5, -0.7], [1.2, -0.6], [1.6, 0.1]]), mouthWidth: 0.6, mouthHook: 0.5, mouthAsym: 0.6,
      squash: K(t, [[0, 0], [0.2, 0.04], [0.5, -0.02], [0.8, 0]]), flameAmp: 0.8,
    }),
  },
};
