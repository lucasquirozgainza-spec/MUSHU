// Alimentos: diseño vectorial propio (centrado en 0,0, ~28 px) + efecto sobre las estadísticas.
// El mismo dibujo se usa en la escena (al comer) y en el inventario de la interfaz.

export const FOODS = [
  {
    id: 'manzana', name: 'Manzana', category: 'Frutas', rarity: 'común', color: '#ff4f6d',
    effect: { hunger: 18, happiness: 4, energy: 2, xp: 4 },
    svg: `
      <path d="M0 -6C-4 -10 -13 -9 -13 0C-13 9 -6 14 -2.5 13C-1 12.6 1 12.6 2.5 13C6 14 13 9 13 0C13 -9 4 -10 0 -6Z" fill="url(#fd-apple)"/>
      <path d="M-8 -4C-10 0 -9 5 -7 7" stroke="#fff" stroke-opacity=".55" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M0 -6C0 -9 1 -12 3 -14" stroke="#7a3b1d" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M2 -11C6 -16 11 -14 12 -12C8 -9 5 -9 2 -11Z" fill="#4ccf6a"/>`,
  },
  {
    id: 'galleta', name: 'Galleta', category: 'Galletas', rarity: 'común', color: '#e0a052',
    effect: { hunger: 14, happiness: 8, energy: 3, xp: 4 },
    svg: `
      <circle r="13" fill="url(#fd-cookie)"/>
      <circle r="13" fill="none" stroke="#b26b26" stroke-opacity=".35" stroke-width="1.4"/>
      <ellipse cx="-4.5" cy="-4" rx="2.4" ry="2" fill="#5a2e14"/>
      <ellipse cx="4.5" cy="-1.5" rx="2.2" ry="1.9" fill="#5a2e14"/>
      <ellipse cx="-1" cy="5" rx="2.4" ry="2" fill="#5a2e14"/>
      <ellipse cx="6" cy="6" rx="1.6" ry="1.4" fill="#5a2e14"/>
      <ellipse cx="-7.5" cy="3" rx="1.5" ry="1.3" fill="#5a2e14"/>
      <path d="M-8 -8A11 11 0 0 1 2 -11" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'caramelo', name: 'Caramelo', category: 'Dulces', rarity: 'común', color: '#ff7ac8',
    effect: { hunger: 6, happiness: 14, energy: 6, xp: 3 },
    svg: `
      <path d="M-8 0L-15 -6L-14 6Z" fill="#ffd36b"/><path d="M8 0L15 -6L14 6Z" fill="#ffd36b"/>
      <circle r="8.5" fill="url(#fd-candy)"/>
      <path d="M-6 -5C-2 -8 3 -6 2 -2C1 2 -4 1 -3 -2" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-opacity=".9"/>
      <path d="M2 4C5 3 7 0 6.5 -3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-opacity=".6"/>`,
  },
  {
    id: 'pastel', name: 'Pastel', category: 'Pasteles', rarity: 'poco común', color: '#ff8fb8',
    effect: { hunger: 24, happiness: 16, energy: 4, xp: 8 },
    svg: `
      <path d="M-13 3L13 -4L13 10L-13 12Z" fill="#f7c98b"/>
      <path d="M-13 3L13 -4L13 1L-13 7Z" fill="#ff8fb8"/>
      <path d="M-13 12L13 10" stroke="#d99a55" stroke-width="1.2"/>
      <path d="M-14 3C-10 -3 -2 -9 6 -10C10 -10 13 -7 13 -4L-13 3Z" fill="#fff4f8"/>
      <path d="M-13 3C-11 5 -9 2 -7 4C-5 6 -3 1 -1 3C1 5 3 0 5 1.5C7 3 9 -1 13 -1" stroke="#fff4f8" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <circle cx="4" cy="-11.5" r="3.6" fill="#ff3d63"/>
      <circle cx="3" cy="-12.6" r="1" fill="#fff" fill-opacity=".8"/>
      <path d="M4 -15C5 -18 7 -19 9 -19" stroke="#4a8a2a" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: 'onigiri', name: 'Onigiri especial', category: 'Comida especial', rarity: 'poco común', color: '#f4f4f4',
    effect: { hunger: 32, happiness: 10, energy: 12, xp: 10 },
    svg: `
      <path d="M0 -14C4 -14 14 2 13 8C12 13 6 13 0 13C-6 13 -12 13 -13 8C-14 2 -4 -14 0 -14Z" fill="url(#fd-rice)"/>
      <path d="M-8 4H8V13C4 13.6 -4 13.6 -8 13Z" fill="#1f3b2c"/>
      <path d="M-6 6H6" stroke="#2f5a43" stroke-width="1"/>
      <circle cx="-4.5" cy="-1" r="1.3" fill="#3a2a2a"/><circle cx="4.5" cy="-1" r="1.3" fill="#3a2a2a"/>
      <path d="M-1.6 1.5Q0 3 1.6 1.5" stroke="#3a2a2a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <ellipse cx="-7" cy="1.5" rx="2" ry="1.2" fill="#ff9db8" fill-opacity=".7"/><ellipse cx="7" cy="1.5" rx="2" ry="1.2" fill="#ff9db8" fill-opacity=".7"/>`,
  },
  {
    id: 'estrella', name: 'Fruta estelar', category: 'Premios raros', rarity: 'rara', color: '#ffd84d',
    effect: { hunger: 20, happiness: 28, energy: 20, xp: 25 },
    svg: `
      <circle r="15" fill="url(#fd-glow)"/>
      <path d="M0 -13L3.8 -4.4L13 -3.6L6 2.6L8 12L0 7.2L-8 12L-6 2.6L-13 -3.6L-3.8 -4.4Z" fill="url(#fd-star)" stroke="#ffb020" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M-4 -3L-1 -8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-opacity=".9"/>
      <circle cx="-2.6" cy="1" r="1.1" fill="#7a4a00"/><circle cx="2.6" cy="1" r="1.1" fill="#7a4a00"/>`,
  },
];

export const FOOD_DEFS = `
  <radialGradient id="fd-apple" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#ff8a9c"/><stop offset=".55" stop-color="#ff3d5e"/><stop offset="1" stop-color="#c41d45"/></radialGradient>
  <radialGradient id="fd-cookie" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffd89a"/><stop offset=".7" stop-color="#e6a557"/><stop offset="1" stop-color="#c47f35"/></radialGradient>
  <radialGradient id="fd-candy" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#ffb3e1"/><stop offset=".6" stop-color="#ff5fb3"/><stop offset="1" stop-color="#d7358e"/></radialGradient>
  <linearGradient id="fd-rice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e4ee"/></linearGradient>
  <radialGradient id="fd-star" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff6b0"/><stop offset=".6" stop-color="#ffd84d"/><stop offset="1" stop-color="#ffab1f"/></radialGradient>
  <radialGradient id="fd-glow"><stop offset="0" stop-color="#fff3a6" stop-opacity=".9"/><stop offset="1" stop-color="#fff3a6" stop-opacity="0"/></radialGradient>
`;

export const foodById = (id) => FOODS.find((f) => f.id === id);

// SVG independiente de un alimento (para botones del inventario).
export function foodIcon(food, size = 44) {
  return `<svg viewBox="-18 -20 36 36" width="${size}" height="${size}" aria-hidden="true"><defs>${FOOD_DEFS}</defs>${food.svg}</svg>`;
}
