// Armario: catálogo de prendas con diseño propio.
// Cada prenda pertenece a una ranura y se dibuja en el espacio del personaje:
//   head  → origen en lo alto de la cabeza (152, 68), y hacia arriba negativo
//   face  → coordenadas del rostro (ojos en 134,158 y 182,157)
//   hand  → origen en la palma derecha, el objeto se mantiene vertical
//   body  → coordenadas del cuerpo; se recorta con la silueta (siempre ajustado)
//   neck  → coordenadas del cuerpo, sin recorte
//   back  → capa procedural detrás del cuerpo (ondea con el movimiento)
//   feet  → zapatos procedurales sobre los pies
// unlock.careDays: días de cuidados necesarios para desbloquear la prenda.

export const SLOTS = [
  { id: 'head', label: 'Gorros' },
  { id: 'face', label: 'Gafas' },
  { id: 'hand', label: 'En la mano' },
  { id: 'body', label: 'Chaquetas' },
  { id: 'neck', label: 'Cuello' },
  { id: 'back', label: 'Capas' },
  { id: 'feet', label: 'Zapatos' },
];

const G = {
  gold: `<linearGradient id="w-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a1"/><stop offset=".45" stop-color="#ffcc3d"/><stop offset="1" stop-color="#d98a12"/></linearGradient>`,
  red: `<linearGradient id="w-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a5a"/><stop offset="1" stop-color="#c81e2f"/></linearGradient>`,
  blue: `<linearGradient id="w-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8dff"/><stop offset="1" stop-color="#1f4fc4"/></linearGradient>`,
  lens: `<linearGradient id="w-lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3550"/><stop offset="1" stop-color="#0e0c18"/></linearGradient>`,
  denim: `<linearGradient id="w-denim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d8fd6"/><stop offset="1" stop-color="#2e5aa0"/></linearGradient>`,
  leather: `<linearGradient id="w-leather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4458"/><stop offset=".5" stop-color="#1d1a26"/><stop offset="1" stop-color="#2b2735"/></linearGradient>`,
  hoodie: `<linearGradient id="w-hoodie" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a7a"/><stop offset="1" stop-color="#f0645a"/></linearGradient>`,
  mint: `<linearGradient id="w-mint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ff0cf"/><stop offset="1" stop-color="#3fc79b"/></linearGradient>`,
  purple: `<linearGradient id="w-purple" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6bff"/><stop offset="1" stop-color="#5a2fc4"/></linearGradient>`,
  night: `<linearGradient id="w-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4fd8"/><stop offset="1" stop-color="#1c2378"/></linearGradient>`,
  black: `<linearGradient id="w-black" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3946"/><stop offset="1" stop-color="#121119"/></linearGradient>`,
};
export const WARDROBE_DEFS = Object.values(G).join('');

const star = (x, y, r, fill) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
};
const heart = (cx, cy, s, fill, extra = '') =>
  `<path transform="translate(${cx} ${cy}) scale(${s})" d="M0 9C-6 4 -11 .5 -11 -4.2C-11 -8 -7.8 -10 -5 -10C-2.6 -10 -.9 -8.6 0 -6.8C.9 -8.6 2.6 -10 5 -10C7.8 -10 11 -8 11 -4.2C11 .5 6 4 0 9Z" fill="${fill}" ${extra}/>`;

// Línea de cuello común de chaquetas y suéteres (debajo de la boca).
const NECK = 'M30 203 Q96 210 128 212 Q154 226 180 212 Q212 208 272 199 L272 300 L30 300 Z';

export const ITEMS = [
  // ---------------- gorros ----------------
  { id: 'corona', slot: 'head', name: 'Coronita', tilt: -8, svg: `
    <path d="M-33 -6 L-36 -34 L-22 -20 L-15 -43 L-6 -22 L0 -49 L6 -22 L15 -43 L22 -20 L36 -34 L33 -6 Z" fill="url(#w-gold)" stroke="#c07a0c" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="-35" y="-15" width="70" height="11" rx="4" fill="url(#w-gold)" stroke="#c07a0c" stroke-width="1.4"/>
    <circle cx="0" cy="-9.5" r="4" fill="#ff3d6e"/><circle cx="-20" cy="-9.5" r="3" fill="#4fb3ff"/><circle cx="20" cy="-9.5" r="3" fill="#4fb3ff"/>
    <circle cx="-36" cy="-35" r="3" fill="#fff6c2"/><circle cx="-15" cy="-44" r="3" fill="#fff6c2"/><circle cx="0" cy="-50" r="3.4" fill="#fff6c2"/><circle cx="15" cy="-44" r="3" fill="#fff6c2"/><circle cx="36" cy="-35" r="3" fill="#fff6c2"/>
    <path d="M-28 -24 L-26 -12" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>` },
  { id: 'heroe', slot: 'head', name: 'Gorro de superhéroe', tilt: -5, svg: `
    <path d="M-52 2 C-54 -38 -28 -60 0 -60 C28 -60 54 -38 52 2 Z" fill="url(#w-red)"/>
    <path d="M-10 -59 C-6 -40 -6 -20 -8 -4 L8 -4 C6 -20 6 -40 10 -59 C4 -60.5 -4 -60.5 -10 -59 Z" fill="url(#w-blue)"/>
    <path d="M-40 -42 C-30 -52 -16 -57 -2 -58" stroke="#fff" stroke-opacity=".35" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="-55" y="-12" width="110" height="16" rx="7" fill="url(#w-blue)"/>
    <circle cx="-30" cy="-30" r="11" fill="#1f4fc4" stroke="#fff" stroke-width="2"/>${star(-30, -30, 8, '#fff')}
    <path d="M-55 -4 H55" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>` },
  { id: 'lana', slot: 'head', name: 'Gorro de lana', tilt: 6, svg: `
    <path d="M-50 0 C-52 -40 -26 -58 0 -58 C26 -58 52 -40 50 0 Z" fill="url(#w-mint)"/>
    ${[-36, -24, -12, 0, 12, 24, 36].map((x) => `<path d="M${x} -2 C${x * 0.95} -26 ${x * 0.7} -44 ${x * 0.5} -54" stroke="#2fa984" stroke-opacity=".45" stroke-width="2" fill="none"/>`).join('')}
    <rect x="-54" y="-14" width="108" height="18" rx="8" fill="#2fb88c"/>
    ${[-44, -33, -22, -11, 0, 11, 22, 33, 44].map((x) => `<path d="M${x} -12 V2" stroke="#1f8f6c" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/>`).join('')}
    <circle cx="0" cy="-64" r="13" fill="#fff6e8"/><circle cx="-6" cy="-69" r="5" fill="#fff" opacity=".8"/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<circle cx="${(Math.cos(a * Math.PI / 180) * 12).toFixed(1)}" cy="${(-64 + Math.sin(a * Math.PI / 180) * 12).toFixed(1)}" r="4" fill="#fff6e8"/>`).join('')}` },
  { id: 'gorra', slot: 'head', name: 'Gorra', tilt: -4, svg: `
    <path d="M28 -4 C48 -10 74 -6 84 4 C64 12 42 10 26 4 Z" fill="#5a2fc4"/>
    <path d="M-46 2 C-48 -34 -24 -52 0 -52 C24 -52 48 -34 46 2 Z" fill="url(#w-purple)"/>
    <path d="M0 -52 V0 M-24 -46 C-30 -30 -32 -14 -32 0 M24 -46 C30 -30 32 -14 32 0" stroke="#3d1d93" stroke-opacity=".5" stroke-width="1.8" fill="none"/>
    <circle cx="0" cy="-52" r="4" fill="#3d1d93"/>
    <path d="M-34 -34 C-26 -44 -14 -49 -2 -50" stroke="#fff" stroke-opacity=".35" stroke-width="4" fill="none" stroke-linecap="round"/>
    <text x="0" y="-18" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="16" fill="#ffd84d">M</text>` },
  { id: 'copa', slot: 'head', name: 'Sombrero de copa', tilt: -7, unlock: { careDays: 15 }, svg: `
    <ellipse cx="0" cy="-4" rx="54" ry="9" fill="#1a1822"/>
    <path d="M-31 -6 L-29 -62 C-29 -66 29 -66 29 -62 L31 -6 Z" fill="url(#w-black)"/>
    <ellipse cx="0" cy="-62" rx="29" ry="5" fill="#2e2b3a"/>
    <rect x="-31" y="-20" width="62" height="12" fill="#b23ef0"/>
    <path d="M-22 -56 L-20 -24" stroke="#fff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>` },
  { id: 'fiesta', slot: 'head', name: 'Gorro de fiesta', tilt: 10, svg: `
    <path d="M-27 -2 L0 -72 L27 -2 Z" fill="#ff6fae"/>
    <path d="M-20 -20 L18 -28 L13 -40 L-13 -32 Z M-8 -52 L8 -56 L4 -64 L-4 -62 Z" fill="#ffd84d"/>
    <path d="M-27 -2 Q0 6 27 -2" stroke="#ff3d8e" stroke-width="3" fill="none"/>
    <circle cx="0" cy="-74" r="7" fill="#5fd4ff"/><circle cx="-2" cy="-76" r="2.4" fill="#fff" opacity=".8"/>
    <circle cx="-14" cy="-10" r="2.2" fill="#fff"/><circle cx="10" cy="-46" r="2" fill="#fff"/><circle cx="12" cy="-12" r="2.2" fill="#5fd4ff"/>` },
  { id: 'chef', slot: 'head', name: 'Gorro de chef', tilt: -3, svg: `
    <circle cx="-24" cy="-36" r="19" fill="#fff"/><circle cx="24" cy="-36" r="19" fill="#fff"/><circle cx="0" cy="-48" r="24" fill="#fff"/>
    <path d="M-36 -2 L-34 -24 H34 L36 -2 Z" fill="#f4f1fa"/>
    <path d="M-36 -2 Q0 4 36 -2" stroke="#d9d2e6" stroke-width="2" fill="none"/>
    <path d="M-12 -22 V-4 M0 -22 V-3 M12 -22 V-4" stroke="#e2dcef" stroke-width="2"/>
    <path d="M-30 -48 C-26 -56 -18 -58 -12 -56" stroke="#e6e0f2" stroke-width="3" fill="none" stroke-linecap="round"/>` },
  { id: 'mago', slot: 'head', name: 'Sombrero de mago', tilt: -6, svg: `
    <path d="M-44 -4 C-30 -12 -16 -40 -6 -70 C0 -88 16 -94 26 -86 C16 -84 10 -74 12 -60 C14 -38 30 -14 44 -4 Z" fill="url(#w-night)"/>
    <ellipse cx="0" cy="-3" rx="58" ry="10" fill="#1c2378"/>
    ${star(-10, -30, 7, '#ffd84d')}${star(14, -48, 5, '#ffd84d')}${star(18, -18, 4, '#fff6b0')}
    <circle cx="26" cy="-86" r="4" fill="#ffd84d"/>` },
  { id: 'pirata', slot: 'head', name: 'Sombrero pirata', tilt: -4, svg: `
    <path d="M-58 -2 C-42 -16 -32 -52 0 -52 C32 -52 42 -16 58 -2 C32 -12 -32 -12 -58 -2 Z" fill="url(#w-black)" stroke="#d9a72b" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="0" cy="-30" r="7" fill="#fff"/><rect x="-4" y="-26" width="8" height="5" rx="1.5" fill="#fff"/>
    <circle cx="-2.6" cy="-31" r="1.6" fill="#1a1822"/><circle cx="2.6" cy="-31" r="1.6" fill="#1a1822"/>
    <path d="M-12 -20 L12 -14 M12 -20 L-12 -14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>` },
  { id: 'orejas', slot: 'head', name: 'Orejitas de gato', tilt: 0, svg: `
    <path d="M-48 2 C-40 -36 40 -36 48 2" stroke="#2b2735" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M-44 -14 L-36 -46 L-18 -26 Z" fill="#2b2735"/><path d="M-38 -20 L-34 -38 L-24 -27 Z" fill="#ff8fc0"/>
    <path d="M44 -14 L36 -46 L18 -26 Z" fill="#2b2735"/><path d="M38 -20 L34 -38 L24 -27 Z" fill="#ff8fc0"/>` },

  // ---------------- gafas ----------------
  { id: 'sol', slot: 'face', name: 'Gafas de sol', svg: `
    <path d="M100 148 L92 152 M216 147 L224 151" stroke="#141218" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M106 144 C106 140 156 140 157 144 C158 160 150 174 132 174 C114 174 106 160 106 144 Z" fill="url(#w-lens)" stroke="#141218" stroke-width="3"/>
    <path d="M159 143 C160 139 210 139 210 143 C210 159 202 173 184 173 C166 173 158 159 159 143 Z" fill="url(#w-lens)" stroke="#141218" stroke-width="3"/>
    <path d="M154 146 Q158 142 162 146" stroke="#141218" stroke-width="3" fill="none"/>
    <path d="M114 150 L124 162 M120 147 L132 161" stroke="#fff" stroke-opacity=".35" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M168 149 L178 161" stroke="#fff" stroke-opacity=".3" stroke-width="2.6" stroke-linecap="round"/>` },
  { id: 'redondas', slot: 'face', name: 'Gafas redondas', svg: `
    <circle cx="134" cy="159" r="25" fill="#e8f6ff" fill-opacity=".18" stroke="#6b3a1e" stroke-width="3.2"/>
    <circle cx="182.5" cy="158" r="25" fill="#e8f6ff" fill-opacity=".18" stroke="#6b3a1e" stroke-width="3.2"/>
    <path d="M155 154 Q158.5 149 162 154" stroke="#6b3a1e" stroke-width="3" fill="none"/>
    <path d="M109 156 L98 152 M207.5 155 L218 151" stroke="#6b3a1e" stroke-width="3" stroke-linecap="round"/>
    <path d="M118 148 A20 20 0 0 1 130 140" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M166 147 A20 20 0 0 1 178 139" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" fill="none" stroke-linecap="round"/>` },
  { id: 'corazon', slot: 'face', name: 'Gafas de corazón', svg: `
    ${heart(133, 160, 2.45, '#ff4f8f', 'fill-opacity=".85" stroke="#d61f68" stroke-width="1.2"')}
    ${heart(183, 159, 2.45, '#ff4f8f', 'fill-opacity=".85" stroke="#d61f68" stroke-width="1.2"')}
    <path d="M154 152 Q158 148 162 152" stroke="#d61f68" stroke-width="3" fill="none"/>
    <path d="M115 150 C117 146 121 144 124 144" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" fill="none" stroke-linecap="round"/>` },
  { id: 'antifaz', slot: 'face', name: 'Antifaz', svg: `
    <path fill-rule="evenodd" fill="url(#w-blue)" stroke="#16389a" stroke-width="1.6" d="M96 150 C100 134 126 130 158 140 C190 130 216 134 220 150 C222 166 210 186 186 184 C170 183 162 176 158 170 C154 176 146 183 130 184 C106 186 94 166 96 150 Z
      M134 138 C150 138 156 150 156 160 C156 172 146 180 134 180 C120 180 112 170 112 158 C112 146 120 138 134 138 Z
      M182 137 C196 137 204 148 204 159 C204 171 196 180 182 180 C168 180 160 171 160 159 C160 148 168 137 182 137 Z"/>
    <path d="M96 150 L84 140 M220 150 L232 140" stroke="#1f4fc4" stroke-width="4" stroke-linecap="round"/>` },
  { id: 'parche', slot: 'face', name: 'Parche pirata', svg: `
    <path d="M100 126 L214 178" stroke="#1a1822" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M112 148 C112 140 156 140 156 148 C156 166 146 180 134 180 C122 180 112 166 112 148 Z" fill="url(#w-black)"/>
    <path d="M120 150 C124 146 132 145 138 146" stroke="#fff" stroke-opacity=".2" stroke-width="3" fill="none" stroke-linecap="round"/>` },

  // ---------------- en la mano ----------------
  { id: 'cetro', slot: 'hand', name: 'Cetro', svg: `
    <rect x="-3" y="-60" width="6" height="74" rx="3" fill="url(#w-gold)" stroke="#c07a0c" stroke-width="1.2"/>
    <rect x="-5.5" y="-30" width="11" height="5" rx="2" fill="#ffcc3d" stroke="#c07a0c" stroke-width="1"/>
    <rect x="-5.5" y="4" width="11" height="5" rx="2" fill="#ffcc3d" stroke="#c07a0c" stroke-width="1"/>
    <path d="M-10 -60 L10 -60 L6 -66 L-6 -66 Z" fill="url(#w-gold)"/>
    <circle cx="0" cy="-75" r="10" fill="#b23ef0" stroke="#ffcc3d" stroke-width="2.4"/>
    <circle cx="-3" cy="-78" r="3.4" fill="#fff" opacity=".7"/>
    <path d="M0 -85 V-95 M-5 -90 H5" stroke="#ffcc3d" stroke-width="3" stroke-linecap="round"/>` },
  { id: 'varita', slot: 'hand', name: 'Varita mágica', svg: `
    <rect x="-2.2" y="-48" width="4.4" height="60" rx="2" fill="#2b2735"/>
    <rect x="-2.2" y="2" width="4.4" height="10" rx="2" fill="#ffcc3d"/>
    ${star(0, -56, 14, '#ffd84d')}
    <circle cx="-12" cy="-70" r="2" fill="#fff"/><circle cx="14" cy="-66" r="1.6" fill="#fff"/><circle cx="10" cy="-76" r="1.2" fill="#fff6b0"/>` },
  { id: 'globo', slot: 'hand', name: 'Globo de corazón', svg: `
    <path d="M0 4 C6 -20 -8 -50 6 -78" stroke="#8a6a9a" stroke-width="1.4" fill="none"/>
    ${heart(8, -96, 2.2, '#ff4f7b')}
    <path d="M-6 -104 C-4 -110 2 -112 6 -110" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M4 -76 L12 -76 L8 -80 Z" fill="#e6305f"/>` },
  { id: 'flor', slot: 'hand', name: 'Flor', svg: `
    <path d="M0 8 C-2 -10 2 -26 0 -40" stroke="#3aa652" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M0 -14 C8 -22 16 -20 18 -16 C12 -10 6 -10 0 -14 Z" fill="#4cc96a"/>
    ${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="${(Math.cos(a * Math.PI / 180) * 9).toFixed(1)}" cy="${(-48 + Math.sin(a * Math.PI / 180) * 9).toFixed(1)}" rx="7" ry="5" transform="rotate(${a} ${(Math.cos(a * Math.PI / 180) * 9).toFixed(1)} ${(-48 + Math.sin(a * Math.PI / 180) * 9).toFixed(1)})" fill="#fff"/>`).join('')}
    <circle cx="0" cy="-48" r="6" fill="#ffcc3d"/>` },

  // ---------------- chaquetas (recortadas a la silueta) ----------------
  { id: 'sudadera', slot: 'body', name: 'Sudadera', sleeve: '#f0645a', cuff: '#d94a44', svg: `
    <path d="${NECK}" fill="url(#w-hoodie)"/>
    <path d="M30 203 Q96 210 128 212 Q154 226 180 212 Q212 208 272 199" stroke="#d94a44" stroke-width="5" fill="none"/>
    <path d="M140 220 L138 246 M168 220 L170 246" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="135" y="244" width="6" height="7" rx="2" fill="#fff"/><rect x="167" y="244" width="6" height="7" rx="2" fill="#fff"/>
    <path d="M114 262 C118 236 190 236 196 262 Z" fill="#e85a52"/>
    <path d="M114 262 C118 236 190 236 196 262" stroke="#c9423d" stroke-width="2" fill="none"/>` },
  { id: 'vaquera', slot: 'body', name: 'Chaqueta vaquera', sleeve: '#3f6fbc', cuff: '#2e5aa0', svg: `
    <path d="M30 203 Q96 210 128 212 L140 260 L30 300 Z M272 199 Q212 208 180 212 L168 260 L272 300 Z" fill="url(#w-denim)"/>
    <path d="M30 300 L140 260 L168 260 L272 300 Z" fill="url(#w-denim)"/>
    <path d="M128 212 L146 238 L118 226 Z M180 212 L162 238 L190 226 Z" fill="#7fa8e6"/>
    <path d="M140 230 L141 262 M168 230 L167 262" stroke="#e8a64a" stroke-width="1.6" stroke-dasharray="3 3"/>
    <path d="M92 222 H122 V236 H92 Z M186 222 H216 V236 H186 Z" fill="none" stroke="#e8a64a" stroke-width="1.6" stroke-dasharray="3 3"/>
    <circle cx="107" cy="230" r="2.4" fill="#d9d2c0"/><circle cx="201" cy="230" r="2.4" fill="#d9d2c0"/>
    <circle cx="136" cy="246" r="2.6" fill="#d9d2c0"/><circle cx="172" cy="246" r="2.6" fill="#d9d2c0"/>` },
  { id: 'cuero', slot: 'body', name: 'Chaqueta de cuero', sleeve: '#22202c', cuff: '#111018', svg: `
    <path d="${NECK}" fill="url(#w-leather)"/>
    <path d="M128 212 L112 236 L140 226 Z M180 212 L200 232 L168 228 Z" fill="#3c3848"/>
    <path d="M160 222 L148 262" stroke="#c9c9d6" stroke-width="2.4" stroke-dasharray="2 2"/>
    <path d="M96 240 H124" stroke="#c9c9d6" stroke-width="2" stroke-linecap="round"/>
    <path d="M70 222 C80 240 82 256 80 270" stroke="#fff" stroke-opacity=".12" stroke-width="8" fill="none" stroke-linecap="round"/>` },
  { id: 'sueter', slot: 'body', name: 'Suéter de rayas', sleeve: '#2fb3a0', cuff: '#f6ecd6', svg: `
    <path d="${NECK}" fill="#f6ecd6"/>
    ${[220, 236, 252, 268].map((y) => `<rect x="20" y="${y}" width="270" height="8" fill="#2fb3a0"/>`).join('')}
    <path d="M30 203 Q96 210 128 212 Q154 226 180 212 Q212 208 272 199" stroke="#e9dcbd" stroke-width="7" fill="none"/>` },
  { id: 'traje', slot: 'body', name: 'Esmoquin', sleeve: '#1b1a24', cuff: '#ffffff', unlock: { careDays: 30 }, svg: `
    <path d="${NECK}" fill="url(#w-black)"/>
    <path d="M128 212 Q154 226 180 212 L162 262 L146 262 Z" fill="#fff"/>
    <path d="M128 212 L146 262 L132 262 L114 230 Z M180 212 L162 262 L176 262 L194 230 Z" fill="#2c2a36"/>
    <path d="M144 220 L154 214 L164 220 L154 226 Z" fill="#e5484d"/><path d="M144 220 L136 214 L136 226 Z M164 220 L172 214 L172 226 Z" fill="#c9303a"/>
    <circle cx="154" cy="238" r="1.8" fill="#1b1a24"/><circle cx="154" cy="250" r="1.8" fill="#1b1a24"/>` },

  // ---------------- cuello ----------------
  { id: 'bufanda', slot: 'neck', name: 'Bufanda', svg: `
    <path d="M66 200 Q154 222 234 196 L236 212 Q154 238 64 216 Z" fill="#e5484d"/>
    ${[90, 120, 150, 180, 210].map((x) => `<path d="M${x} ${x < 154 ? 204 + (x - 66) * 0.09 : 216 - (x - 154) * 0.2} l6 0 l0 16 l-6 0 Z" fill="#fff" opacity=".9"/>`).join('')}
    <path d="M190 210 C196 226 200 240 196 256 L210 254 C212 238 208 222 204 208 Z" fill="#e5484d"/>
    <path d="M194 236 L208 234 M195 244 L209 242" stroke="#fff" stroke-width="3"/>
    <path d="M196 256 L196 262 M200 256 L201 262 M204 255 L205 261 M208 254 L209 260" stroke="#e5484d" stroke-width="2" stroke-linecap="round"/>` },
  { id: 'corbatin', slot: 'neck', name: 'Corbatín', svg: `
    <path d="M154 214 L136 204 C132 210 132 220 136 226 Z" fill="#e5484d"/><path d="M154 214 L172 204 C176 210 176 220 172 226 Z" fill="#e5484d"/>
    <rect x="148" y="208" width="12" height="12" rx="4" fill="#c9303a"/>
    <path d="M139 208 L146 212" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>` },
  { id: 'perlas', slot: 'neck', name: 'Collar de perlas', svg: `
    ${Array.from({ length: 15 }, (_, i) => { const u = i / 14; const x = 100 + u * 108; const y = 206 + Math.sin(u * Math.PI) * 16; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#fffaf2" stroke="#e6dccb" stroke-width=".8"/>`; }).join('')}` },

  // ---------------- capas (procedurales) ----------------
  { id: 'capa', slot: 'back', name: 'Capa de héroe', cape: { a: '#e5484d', b: '#a4182a', trim: null, stars: false } },
  { id: 'capaMago', slot: 'back', name: 'Capa de mago', cape: { a: '#3b4fd8', b: '#1c2378', trim: null, stars: true } },
  { id: 'capaReal', slot: 'back', name: 'Capa real', unlock: { careDays: 60 }, cape: { a: '#8f3de0', b: '#4b168f', trim: '#fffaf2', stars: false } },

  // ---------------- zapatos (procedurales) ----------------
  { id: 'zapatillas', slot: 'feet', name: 'Zapatillas', shoe: { base: '#ffffff', shade: '#dcd6e8', sole: '#ff4f7b', laces: true, boot: 0 } },
  { id: 'botas', slot: 'feet', name: 'Botas', shoe: { base: '#9a5a2e', shade: '#6e3c1a', sole: '#3a2414', laces: false, boot: 12 } },
  { id: 'pantuflas', slot: 'feet', name: 'Pantuflas', shoe: { base: '#ffc2dc', shade: '#ff9cc4', sole: '#ffffff', laces: false, boot: 0, fluffy: true } },
];

export const COSTUMES = [
  { id: 'superheroe', name: 'Superhéroe', outfit: { head: 'heroe', face: 'antifaz', back: 'capa' } },
  { id: 'rey', name: 'Rey', outfit: { head: 'corona', hand: 'cetro', back: 'capa', neck: 'perlas' } },
  { id: 'pirataD', name: 'Pirata', outfit: { head: 'pirata', face: 'parche', body: 'sueter' } },
  { id: 'magoD', name: 'Mago', outfit: { head: 'mago', hand: 'varita', back: 'capaMago' } },
  { id: 'chefD', name: 'Chef', outfit: { head: 'chef', neck: 'corbatin' } },
  { id: 'elegante', name: 'Elegante', outfit: { head: 'copa', body: 'traje', feet: 'zapatillas' } },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id);
export const isUnlocked = (item, careDays) => !item.unlock || careDays >= (item.unlock.careDays || 0);

// ---- dibujo procedural de capas y zapatos ----
export function capePath(t, lag) {
  const w1 = Math.sin(t * 2.2) * 4 + lag * 1.2, w2 = Math.sin(t * 2.2 + 1.7) * 4 + lag * 1.6, w3 = Math.sin(t * 2.2 + 3.1) * 4 + lag * 1.2;
  return `M82 176 C70 200 50 230 ${36 + w1} 266 Q${80 + w2} ${258 + w2 * 0.5} ${110} ${268 + w1 * 0.4} Q${150 + w2} ${260 + w3 * 0.4} ${190} ${268 + w3 * 0.4} Q${226 + w3} ${258 + w2 * 0.5} ${262 + w3} 266 C250 230 230 200 218 176 Z`;
}

// Miniatura SVG de una prenda (para el armario).
const THUMB_VB = { head: '-62 -100 124 112', face: '84 120 148 70', hand: '-34 -112 68 128', body: '40 196 230 74', neck: '58 190 194 76' };
export function itemThumb(item, size = 64) {
  let inner = item.svg || '', vb = THUMB_VB[item.slot];
  if (item.slot === 'body') inner = `<clipPath id="th-${item.id}"><rect x="56" y="196" width="196" height="74" rx="30"/></clipPath><g clip-path="url(#th-${item.id})">${inner}</g>`;
  if (item.slot === 'back') { vb = '26 166 248 110'; inner = `<path d="${capePath(0.4, 0)}" fill="${item.cape.a}" stroke="${item.cape.b}" stroke-width="3"/>${item.cape.trim ? `<path d="M80 180 Q150 196 220 180" stroke="${item.cape.trim}" stroke-width="10" fill="none"/>` : ''}${item.cape.stars ? star(120, 230, 9, '#ffd84d') + star(180, 214, 7, '#ffd84d') : ''}`; }
  if (item.slot === 'feet') { vb = '-12 -16 52 40'; const s = item.shoe; inner = `<path d="M-6 -${4 + s.boot} L4 -${4 + s.boot} L5 2 C14 4 24 6 32 10 C34 14 30 16 24 16 L-6 16 C-9 16 -9 10 -6 -${4 + s.boot} Z" fill="${s.base}" stroke="${s.shade}" stroke-width="2"/><path d="M-7 14 H30" stroke="${s.sole}" stroke-width="4" stroke-linecap="round"/>${s.laces ? '<circle cx="9" cy="4" r="1.6" fill="#3a3550"/><circle cx="14" cy="6" r="1.6" fill="#3a3550"/>' : ''}`; }
  return `<svg viewBox="${vb}" width="${size}" height="${size}" aria-hidden="true"><defs>${WARDROBE_DEFS}</defs>${inner}</svg>`;
}
