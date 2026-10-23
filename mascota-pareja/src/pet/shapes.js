// Geometría del personaje medida directamente sobre la imagen de referencia
// (espacio de 290×310 px de la imagen original). Todo el rig se dibuja en estas coordenadas.

// Contorno del cuerpo-llama, en sentido horario desde la base.
// g: grupo de llama al que pertenece el punto (L, M, R) y w: cuánto sigue a su punta.
// t: tensión de la tangente (valores bajos = entrante afilado).
export const BODY_POINTS = [
  { p: [150, 247.6] },
  { p: [121, 244.6] },
  { p: [102.5, 238.2] },
  { p: [88.6, 228] },
  { p: [77.8, 216] },
  { p: [70, 202] },
  { p: [64.6, 186] },
  { p: [62.8, 168] },
  { p: [64.4, 150] },
  { p: [68.6, 135.5] },
  { p: [73.8, 120] },
  { p: [78.6, 106] },
  { p: [81.4, 93], g: 'L', w: 0.15 },
  { p: [84.4, 81], g: 'L', w: 0.35 },
  { p: [88.2, 72], g: 'L', w: 0.6 },
  { p: [94.6, 64.6], g: 'L', w: 0.88 },
  { p: [103, 61], g: 'L', w: 1 },
  { p: [109.6, 65.6], g: 'L', w: 0.85 },
  { p: [110.6, 74], g: 'L', w: 0.45 },
  { p: [112.6, 81.5], t: 0.22, g: 'N', w: 1 },
  { p: [116, 72], g: 'M', w: 0.3 },
  { p: [121.6, 61.6], g: 'M', w: 0.42 },
  { p: [131, 52.6], g: 'M', w: 0.52 },
  { p: [145, 46.4], g: 'M', w: 0.64 },
  { p: [162, 42.6], g: 'M', w: 0.76 },
  { p: [174, 39], g: 'M', w: 0.87 },
  { p: [182.6, 34], g: 'M', w: 0.95 },
  { p: [188.2, 31.2], g: 'M', w: 1, t: 0.7 },
  { p: [193.6, 37], g: 'M', w: 0.9 },
  { p: [197, 47.5], g: 'M', w: 0.7 },
  { p: [198.6, 59], g: 'M', w: 0.5 },
  { p: [197.2, 72], g: 'M', w: 0.3 },
  { p: [197.6, 81.2], t: 0.22, g: 'N', w: 1 },
  { p: [202, 71], g: 'R', w: 0.5 },
  { p: [208.6, 63.6], g: 'R', w: 0.8 },
  { p: [215.6, 58.6], g: 'R', w: 0.97 },
  { p: [221, 57.8], g: 'R', w: 1 },
  { p: [223, 66], g: 'R', w: 0.8 },
  { p: [222.6, 80], g: 'R', w: 0.45 },
  { p: [224, 99], g: 'R', w: 0.15 },
  { p: [227.2, 118] },
  { p: [230.6, 134] },
  { p: [232.8, 152] },
  { p: [233.2, 171] },
  { p: [231.4, 187] },
  { p: [227, 200] },
  { p: [220.6, 212.4] },
  { p: [212, 224] },
  { p: [201, 234] },
  { p: [188, 241.6] },
  { p: [171, 246.2] },
];

export const BODY_CENTER_X = 148;
export const BODY_BOTTOM = [150, 247.6]; // pivote de squash/inclinación
export const FACE_ANCHOR = [154, 165];

// Ojos: globo ocular (párpado superior + esclerótica)
export const EYES = {
  L: { cx: 134, cy: 158, rx: 23.8, ry: 23.8 },
  R: { cx: 182.2, cy: 156.8, rx: 23.2, ry: 25.6 },
};
export const IRIS_R = 13;
export const LID_REF = 0.405; // fracción del ojo cubierta por el párpado en la referencia

// Cejas (línea central + grosor) tal como aparecen en la referencia.
export const BROWS = {
  L: {
    pts: [[114.6, 137.4], [123, 134.6], [131.5, 133], [139.6, 131.4], [145.4, 129], [147.6, 124.4], [149.8, 121.4], [152, 122.4]],
    width: (u) => (u < 0.5 ? 9.6 - u * 2.4 : u < 0.75 ? 8.4 - (u - 0.5) * 6 : 6.9 - (u - 0.75) * 7),
    inner: 1, // el extremo interior es el último punto
  },
  R: {
    pts: [[169.4, 124.8], [173.8, 116.4], [180, 108.6], [187, 103.6], [194, 102.4], [199.6, 106.4], [201, 110.4]],
    width: (u) => (u < 0.3 ? 9.4 - u * 4 : 8.2 - (u - 0.3) * 2.4),
    inner: 0,
  },
};

// Boca de la referencia: arco de disgusto + pequeño gancho a la izquierda.
export const MOUTH = { cx: 154.5, cy: 191.5, halfW: 17 };

// Brazos (cuelgan por detrás del cuerpo) — hombro, codo, muñeca en reposo.
export const ARMS = {
  L: { shoulder: [66, 178], len1: 29.4, len2: 28, side: -1, rest: { a1: 0.31, a2: -0.39, hand: 1.45, curl: 1 } },
  R: { shoulder: [230, 178], len1: 27.6, len2: 30, side: 1, rest: { a1: 0.2, a2: -0.28, hand: 1.4, curl: 1 } },
};

// Piernas: cadera (bajo el cuerpo) y tobillo sobre el suelo.
export const LEGS = {
  L: { hip: [125.5, 243], ankle: [119, 259], dir: -1, wHip: 11.5, wAnkle: 12.5,
       foot: [[-6.3, 1.5], [-4.8, 8], [-3.2, 13.4], [-0.6, 15.2], [8, 15.4], [24, 15.2], [32.5, 14], [28, 9.6], [18, 5.6], [10, 3.2], [5, 1.6]],
       tens: [1, 1, 0.6, 1, 1, 1, 0.4, 1, 1, 1, 1] },
  R: { hip: [151.5, 243.5], ankle: [148.5, 260], dir: 1, wHip: 9.2, wAnkle: 9.2,
       foot: [[-4.7, 1.5], [-5.6, 8], [-5.6, 13], [-3, 15.2], [8, 15.4], [22, 15.4], [30.5, 14.2], [26, 10], [18, 7.6], [9, 4.6], [4, 2]],
       tens: [1, 1, 0.6, 1, 1, 1, 0.4, 1, 1, 1, 1] },
};
export const GROUND_Y = 274;
export const SHADOW = { cx: 137, cy: 275.6, rx: 94, ry: 8.6 };
