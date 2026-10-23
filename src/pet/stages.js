// Definición de las etapas evolutivas.
// Las tres etapas comparten exactamente el mismo diseño (geometría, rostro, extremidades)
// y cada una aporta su propia paleta completa. Para añadir una etapa futura basta con
// agregar un objeto a STAGES: el rig, el armario y la lógica de evolución la recogen solos.

const brasa = {
  // Cuerpo (de las puntas de las llamas hacia la base)
  bodyTop: '#d24bfb', bodyUpper: '#ab33f2', bodyMid: '#b83ced', bodyMid2: '#d346dc',
  bodyLower2: '#dc41c4', bodyLower: '#e6379e', bodyBottom: '#ec3594',
  highlight: '#e88aff', rim: '#f15ee2', ao: '#a3127a', edge: '#7a1a9c',
  // Rostro
  lidTop: '#cc50ea', lidBottom: '#bd3fe4', lidLine: '#3d086f', brow: '#64289f',
  mouth: '#7a1592', mouthIn: '#4a0a5e', tongue: '#ff6fae',
  iris: '#a0399a', irisDeep: '#62227e', irisRing: '#f08ac8',
  scleraShade: '#f6a8f2', eyeRim: '#e85bc8', blush: '#ff5fae',
  // Extremidades y suelo
  arm: '#d637bd', armShade: '#b02a9e', leg: '#e7369a', legShade: '#d22f8c',
  shadow: '#c27fcc',
  // Escena
  bg1: '#ffa8fd', bg2: '#ffe0fe', accent: '#b23ef0', accentInk: '#4b0f78',
};

const marea = {
  bodyTop: '#86f8ec', bodyUpper: '#33dccf', bodyMid: '#25c6d6', bodyMid2: '#24ace4',
  bodyLower2: '#2a93ea', bodyLower: '#2f6cf1', bodyBottom: '#355af3',
  highlight: '#c2fff8', rim: '#74d4ff', ao: '#1a2ea6', edge: '#0d3c8c',
  lidTop: '#3fd6dc', lidBottom: '#27b4e0', lidLine: '#0a2463', brow: '#123a8a',
  mouth: '#12307a', mouthIn: '#0b1d4e', tongue: '#ff7fb6',
  iris: '#2a6fb0', irisDeep: '#123a74', irisRing: '#8ce8ff',
  scleraShade: '#b4e2ff', eyeRim: '#5aa7f5', blush: '#ff8fc6',
  arm: '#28aedd', armShade: '#1b82bf', leg: '#3366f0', legShade: '#2447c6',
  shadow: '#6fb2d6',
  bg1: '#9cefee', bg2: '#e0fbff', accent: '#1f8fe0', accentInk: '#0a2a63',
};

const aurora = {
  bodyTop: '#fff27e', bodyUpper: '#ffc93c', bodyMid: '#ffb238', bodyMid2: '#ff953a',
  bodyLower2: '#ff7f45', bodyLower: '#ff5b60', bodyBottom: '#ff4a70',
  highlight: '#fff8c4', rim: '#ffd47c', ao: '#c0234f', edge: '#a2401c',
  lidTop: '#ffc24a', lidBottom: '#ffaa3c', lidLine: '#5e1a10', brow: '#742812',
  mouth: '#741d18', mouthIn: '#4a0f0b', tongue: '#ff7f9a',
  iris: '#9c4a1c', irisDeep: '#5e220c', irisRing: '#ffd56c',
  scleraShade: '#ffd8b8', eyeRim: '#ff9b7a', blush: '#ff6f8f',
  arm: '#ffa236', armShade: '#df7a22', leg: '#ff5a65', legShade: '#d63a4e',
  shadow: '#e2a978',
  bg1: '#ffd79a', bg2: '#fff3df', accent: '#ff7a2f', accentInk: '#5e2108',
};

// form: proporciones de cada etapa. Al crecer se alarga (más alto y algo más delgado),
// las piernas y los brazos son un poco más largos, las llamas suben y los ojos se ven
// algo más pequeños respecto al cuerpo: parece más maduro sin dejar de ser el mismo.
export const STAGES = [
  { id: 1, key: 'brasa', title: 'Primera etapa', subtitle: 'Bebé', defaultStartDay: 0, palette: brasa, ambient: null,
    form: { tall: 0, slim: 0, legs: 0, flame: 0, eyes: 1, arms: 0 } },
  { id: 2, key: 'marea', title: 'Segunda etapa', subtitle: 'Más maduro', defaultStartDay: 600, palette: marea, ambient: 'bubbles',
    form: { tall: 0.09, slim: 0.035, legs: 4, flame: 0.45, eyes: 0.96, arms: 0.08 } },
  { id: 3, key: 'aurora', title: 'Tercera etapa', subtitle: 'Adolescente', defaultStartDay: 900, palette: aurora, ambient: 'embers',
    form: { tall: 0.19, slim: 0.075, legs: 9, flame: 0.85, eyes: 0.92, arms: 0.17 } },
];

export const stageById = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
