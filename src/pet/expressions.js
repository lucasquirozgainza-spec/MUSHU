// Expresiones y estados de ánimo. Cada estado es una pose parcial que el animador
// mezcla suavemente; la expresión "neutral" es exactamente la de la imagen de referencia.

import { LID_REF } from './shapes.js';

export const FACE = {
  // ojos felices cerrados (^^)
  happyClosed: { lidL: 0.6, lidR: 0.6, lowerL: 0.42, lowerR: 0.42, lidArc: -0.24, lowerArc: 0.3 },
  wide: { lidL: 0.1, lidR: 0.1, lowerL: 0, lowerR: 0, lidArc: 0.02, irisScale: 0.92 },
  laugh: { mouthCurve: 0.95, mouthOpen: 0.6, mouthWidth: 1.05, mouthHook: 0, mouthAsym: 0, tongue: 1 },
  smile: { mouthCurve: 0.8, mouthOpen: 0, mouthWidth: 1.02, mouthHook: 0, mouthAsym: 0.15 },
  oh: { mouthCurve: 0, mouthOpen: 0.5, mouthWidth: 0.42, mouthHook: 0, mouthAsym: 0 },
  browsUp: { browL_raise: 4, browR_raise: -2, browL_inner: 1, browR_arch: 1 },
  browsHappy: { browL_raise: 2, browL_inner: 1.5, browR_raise: -6.5, browR_arch: -1.5, browR_inner: 0 },
  browsAngry: { browL_raise: -2, browL_inner: -4, browR_raise: -7, browR_inner: -4, browR_arch: -1 },
};

export const MOODS = {
  neutral: {
    label: 'Normal', tempo: 1, energy: 1,
    gazeHome: [-0.72, 0.12],
    expr: {
      lidL: LID_REF, lidR: LID_REF, lowerL: 0, lowerR: 0, lidTilt: 0, lidArc: 0.04, lowerArc: 0.25,
      browL_raise: 0, browL_inner: 0, browL_outer: 0, browL_arch: 0,
      browR_raise: 0, browR_inner: 0, browR_outer: 0, browR_arch: 0,
      mouthCurve: -0.55, mouthOpen: 0, mouthWidth: 1, mouthAsym: 1, mouthHook: 1, tongue: 0,
      blush: 0, irisScale: 1, sparkle: 0,
      flameAmp: 1, flameSpeed: 1, flameDroop: 0, flameLift: 0, squash: 0,
    },
    fidgets: ['glance', 'browRaise', 'sigh', 'footTap', 'shrug', 'smirk', 'glance'],
  },
  happy: {
    label: 'Feliz', tempo: 1.25, energy: 1.3,
    gazeHome: [-0.1, 0.05],
    expr: {
      lidL: 0.25, lidR: 0.23, lowerL: 0.1, lowerR: 0.1, lidTilt: 0, lidArc: 0.0, lowerArc: 0.35,
      ...FACE.browsHappy, browL_outer: 0, browL_arch: 0.5, browR_outer: 0,
      ...FACE.smile, tongue: 0,
      blush: 0.5, irisScale: 1.04, sparkle: 0.35,
      flameAmp: 1.35, flameSpeed: 1.15, flameDroop: 0, flameLift: 0.3, squash: -0.01,
    },
    fidgets: ['hop', 'sway', 'smirk', 'glance', 'hop'],
  },
  sad: {
    label: 'Triste', tempo: 0.7, energy: 0.6,
    gazeHome: [-0.2, 0.55],
    expr: {
      lidL: 0.5, lidR: 0.5, lowerL: 0.04, lowerR: 0.04, lidTilt: 0.4, lidArc: 0.0, lowerArc: 0.2,
      browL_raise: -1, browL_inner: 5, browL_outer: -1, browL_arch: 0,
      browR_raise: -8, browR_inner: 6, browR_outer: -1, browR_arch: -2,
      mouthCurve: -0.9, mouthOpen: 0, mouthWidth: 0.78, mouthAsym: 0.3, mouthHook: 0.35, tongue: 0,
      blush: 0, irisScale: 1.06, sparkle: 0.65,
      flameAmp: 0.55, flameSpeed: 0.7, flameDroop: 0.75, flameLift: 0, squash: 0.035,
      armL_a1: 0.18, armR_a1: 0.12,
    },
    fidgets: ['sniffle', 'lookDown', 'sigh', 'sniffle'],
  },
  sleepy: {
    label: 'Sueño', tempo: 0.55, energy: 0.5,
    gazeHome: [-0.3, 0.3],
    expr: {
      lidL: 0.74, lidR: 0.7, lowerL: 0.05, lowerR: 0.05, lidTilt: -0.1, lidArc: 0.02, lowerArc: 0.2,
      browL_raise: -1.5, browL_inner: 0.5, browL_outer: 0, browL_arch: 0,
      browR_raise: -5, browR_inner: 0, browR_outer: 0, browR_arch: -1,
      mouthCurve: -0.15, mouthOpen: 0, mouthWidth: 0.85, mouthAsym: 0.5, mouthHook: 0.3, tongue: 0,
      blush: 0, irisScale: 1, sparkle: 0,
      flameAmp: 0.5, flameSpeed: 0.6, flameDroop: 0.35, flameLift: 0, squash: 0.025,
    },
    fidgets: ['yawn', 'nod', 'sigh', 'nod'],
  },
  hungry: {
    label: 'Hambre', tempo: 0.95, energy: 0.9,
    gazeHome: [0.45, -0.35],
    expr: {
      lidL: 0.3, lidR: 0.32, lowerL: 0, lowerR: 0, lidTilt: 0.15, lidArc: 0.03, lowerArc: 0.2,
      browL_raise: 1, browL_inner: 4, browL_outer: 0, browL_arch: 0,
      browR_raise: -5, browR_inner: 3, browR_outer: 0, browR_arch: -1,
      mouthCurve: -0.35, mouthOpen: 0, mouthWidth: 0.82, mouthAsym: 0.6, mouthHook: 0.4, tongue: 0,
      blush: 0, irisScale: 1.05, sparkle: 0.3,
      flameAmp: 0.85, flameSpeed: 0.95, flameDroop: 0.15, flameLift: 0, squash: 0.01,
    },
    fidgets: ['rumble', 'lick', 'glance', 'footTap', 'rumble'],
  },
};

export const MOOD_KEYS = Object.keys(MOODS);
