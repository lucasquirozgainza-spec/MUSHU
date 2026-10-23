// Caja de mudanza que aparece cuando la mascota se independiza.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function boxSVG(name) {
  const label = esc(name.toUpperCase());
  const size = label.length > 8 ? 22 : 30;
  return `
<svg viewBox="0 0 320 300" class="box-svg" role="img" aria-label="Caja de mudanza con el nombre ${esc(name)}">
  <defs>
    <linearGradient id="bx-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a066"/><stop offset="1" stop-color="#b9783f"/></linearGradient>
    <linearGradient id="bx-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a8692f"/><stop offset="1" stop-color="#8d5726"/></linearGradient>
    <linearGradient id="bx-flap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8b47c"/><stop offset="1" stop-color="#cf9358"/></linearGradient>
    <radialGradient id="bx-shadow"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="165" cy="268" rx="130" ry="14" fill="url(#bx-shadow)"/>
  <!-- solapas traseras abiertas -->
  <path d="M70 112 L104 62 L236 62 L262 112 Z" fill="#9b6330"/>
  <path d="M104 62 L84 30 L214 30 L236 62 Z" fill="url(#bx-flap)" opacity=".9"/>
  <!-- lado y frente -->
  <path d="M250 112 L292 92 L292 222 L250 262 Z" fill="url(#bx-side)"/>
  <rect x="58" y="112" width="192" height="150" rx="6" fill="url(#bx-front)"/>
  <path d="M58 112 L250 112 L250 120 L58 120 Z" fill="#000" opacity=".08"/>
  <!-- solapas delanteras -->
  <path d="M58 112 L22 150 L120 150 L154 112 Z" fill="url(#bx-flap)"/>
  <path d="M154 112 L250 112 L292 92 L196 92 Z" fill="#c78a50"/>
  <path d="M250 112 L292 92 L306 128 L262 150 Z" fill="url(#bx-flap)"/>
  <!-- cinta -->
  <rect x="146" y="150" width="16" height="112" fill="#e9cfa2" opacity=".85"/>
  <!-- etiqueta -->
  <g transform="rotate(-4 154 200)">
    <rect x="86" y="168" width="136" height="64" rx="6" fill="#fffdf6" stroke="#e2d6bd" stroke-width="2"/>
    <text x="154" y="${size > 25 ? 211 : 207}" text-anchor="middle" font-family="'Baloo 2', 'Trebuchet MS', sans-serif" font-weight="800" font-size="${size}" fill="#3a2a5a" letter-spacing="1">${label}</text>
  </g>
  <!-- flechas "este lado arriba" -->
  <g fill="none" stroke="#7a4a1e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7">
    <path d="M232 132 v-14 M226 124 l6-6 6 6"/><path d="M76 132 v-14 M70 124 l6-6 6 6"/>
  </g>
</svg>`;
}
