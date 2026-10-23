// Minijuego de «Jugar»: Mushu se mueve con el dedo (o las flechas) para atrapar lo que cae.
// Balón +1, corazón +2, estrella +3. Las nubes de lluvia restan 2. Dura 30 segundos.

import { PetView } from '../pet/index.js';

const ITEMS = {
  ball: { pts: 1, w: 34, svg: '<svg viewBox="-14 -14 28 28"><circle r="13" fill="#fff" stroke="#8d86a0"/><path d="M0 -5 L4.8 -1.5 L3 4 L-3 4 L-4.8 -1.5 Z" fill="#2b2735"/><path d="M0 -5 L0 -12.6 M4.8 -1.5 L11.8 -4.4 M3 4 L7.4 10.4 M-3 4 L-7.4 10.4 M-4.8 -1.5 L-11.8 -4.4" stroke="#2b2735" stroke-width="1.3"/></svg>' },
  heart: { pts: 2, w: 32, svg: '<svg viewBox="-12 -11 24 22"><path d="M0 9C-6 4 -11 .5 -11 -4.2C-11 -8 -7.8 -10 -5 -10C-2.6 -10 -.9 -8.6 0 -6.8C.9 -8.6 2.6 -10 5 -10C7.8 -10 11 -8 11 -4.2C11 .5 6 4 0 9Z" fill="#ff4f7b"/><path d="M-7 -6C-6 -8 -4 -8.4 -3 -8" stroke="#fff" stroke-opacity=".7" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>' },
  star: { pts: 3, w: 34, svg: '<svg viewBox="-12 -12 24 24"><path d="M0 -11L3.2 -3.6L11 -3L5 2.2L6.8 10L0 6L-6.8 10L-5 2.2L-11 -3L-3.2 -3.6Z" fill="#ffd84d" stroke="#ffb01f" stroke-width="1.2" stroke-linejoin="round"/></svg>' },
  cloud: { pts: -2, w: 44, svg: '<svg viewBox="-22 -16 44 34"><path d="M-14 4a7 7 0 0 1 1-14 10 10 0 0 1 19-2 8 8 0 0 1 9 16Z" fill="#8a93a8"/><path d="M-8 9l-2 5M0 9l-2 6M8 9l-2 5" stroke="#5fb5ff" stroke-width="2.4" stroke-linecap="round"/></svg>' },
};
const DURATION = 30;

export class MiniGame {
  constructor({ stage, outfit, name, rewardNote, onEnd }) {
    this.onEnd = onEnd;
    this.el = document.createElement('div');
    this.el.className = 'mg';
    this.el.innerHTML = `
      <div class="mg-hud"><span class="mg-score">0</span><span class="mg-title">Atrapa con ${name}</span><span class="mg-time">${DURATION}</span></div>
      <div class="mg-area"><div class="mg-items"></div><div class="mg-pet"></div>
        <div class="mg-intro"><h2>¡A jugar!</h2><p>Mueve el dedo para que ${name} atrape balones, corazones y estrellas. Esquiva las nubes.</p>${rewardNote ? `<p class="mg-note">${rewardNote}</p>` : ''}<button class="btn primary" type="button" data-mg="start">Empezar</button><button class="btn" type="button" data-mg="close">Salir</button></div>
      </div>`;
    document.body.appendChild(this.el);
    this.area = this.el.querySelector('.mg-area');
    this.itemsEl = this.el.querySelector('.mg-items');
    this.petEl = this.el.querySelector('.mg-pet');
    this.pv = new PetView(this.petEl, { stage, interactive: false, scene: false, viewBox: '20 0 260 300' });
    this.pv.setOutfit(outfit);
    this.pv.setMood('happy');
    this.x = 0.5; this.tx = 0.5; this.vx = 0;
    this.items = []; this.score = 0; this.t = 0; this.spawnT = 0; this.running = false;
    this._loop = this._loop.bind(this);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mg]'); if (!b) return;
      if (b.dataset.mg === 'start') this.start();
      if (b.dataset.mg === 'close') this.close(false);
    });
    const move = (e) => { const r = this.area.getBoundingClientRect(); this.tx = Math.min(0.94, Math.max(0.06, (e.clientX - r.left) / r.width)); };
    this.area.addEventListener('pointerdown', move);
    this.area.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) move(e); });
    this._key = (e) => { if (e.key === 'ArrowLeft') this.tx = Math.max(0.06, this.tx - 0.12); if (e.key === 'ArrowRight') this.tx = Math.min(0.94, this.tx + 0.12); if (e.key === 'Escape') this.close(false); };
    window.addEventListener('keydown', this._key);
    this._place();
  }

  start() {
    this.el.querySelector('.mg-intro').hidden = true;
    this.running = true; this.t = 0; this.score = 0; this._last = performance.now();
    requestAnimationFrame(this._loop);
  }

  _spawn() {
    const r = Math.random();
    const kind = r < 0.42 ? 'ball' : r < 0.62 ? 'heart' : r < 0.74 ? 'star' : 'cloud';
    const el = document.createElement('div');
    el.className = 'mg-item'; el.innerHTML = ITEMS[kind].svg; el.style.width = ITEMS[kind].w + 'px';
    this.itemsEl.appendChild(el);
    const speed = 0.28 + this.t * 0.012 + Math.random() * 0.12;
    this.items.push({ kind, el, x: 0.08 + Math.random() * 0.84, y: -0.08, v: speed, rot: Math.random() * 360, vr: (Math.random() - 0.5) * 200 });
  }

  _place() {
    this.petEl.style.left = `${this.x * 100}%`;
    this.petEl.style.transform = `translateX(-50%) rotate(${Math.max(-12, Math.min(12, this.vx * 25))}deg)`;
  }

  _pop(x, y, text, good) {
    const p = document.createElement('div');
    p.className = 'mg-pop' + (good ? '' : ' bad');
    p.textContent = text; p.style.left = `${x * 100}%`; p.style.top = `${y * 100}%`;
    this.area.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }

  _loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
    this.t += dt;
    const left = Math.max(0, DURATION - this.t);
    this.el.querySelector('.mg-time').textContent = Math.ceil(left);
    // movimiento con inercia
    const prev = this.x;
    this.x += (this.tx - this.x) * Math.min(1, dt * 9);
    this.vx = (this.x - prev) / Math.max(dt, 1e-3);
    this._place();
    // aparecer objetos
    this.spawnT -= dt;
    if (this.spawnT <= 0 && left > 1) { this._spawn(); this.spawnT = Math.max(0.38, 0.85 - this.t * 0.015); }
    const catchY = 0.8;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.y += it.v * dt; it.rot += it.vr * dt;
      it.el.style.left = `${it.x * 100}%`; it.el.style.top = `${it.y * 100}%`;
      it.el.style.transform = `translate(-50%, -50%) rotate(${it.rot}deg)`;
      if (it.y > catchY - 0.06 && it.y < catchY + 0.05 && Math.abs(it.x - this.x) < 0.11) {
        const pts = ITEMS[it.kind].pts;
        this.score = Math.max(0, this.score + pts);
        this._pop(it.x, catchY - 0.12, (pts > 0 ? '+' : '') + pts, pts > 0);
        if (pts > 0) this.pv.anim.request(pts >= 3 ? 'celebrate' : 'hop');
        else this.pv.anim.request('poke', { x: 150, y: 120 });
        it.el.remove(); this.items.splice(i, 1);
        this.el.querySelector('.mg-score').textContent = this.score;
        continue;
      }
      if (it.y > 1.08) { it.el.remove(); this.items.splice(i, 1); }
    }
    if (left <= 0 && !this.items.length) return this._finish();
    requestAnimationFrame(this._loop);
  }

  _finish() {
    this.running = false;
    let best = 0;
    try { best = +localStorage.getItem('mascota.mgBest') || 0; if (this.score > best) localStorage.setItem('mascota.mgBest', String(this.score)); } catch {}
    const record = this.score > best;
    this.pv.anim.request('celebrate');
    const end = document.createElement('div');
    end.className = 'mg-intro';
    end.innerHTML = `<h2>${this.score} puntos</h2><p>${record ? '¡Nuevo récord!' : `Récord: ${best}`}</p><button class="btn primary" type="button" data-mg="done">Listo</button>`;
    this.area.appendChild(end);
    end.querySelector('button').addEventListener('click', () => this.close(true));
  }

  close(played) {
    this.running = false;
    window.removeEventListener('keydown', this._key);
    this.pv.destroy();
    this.el.remove();
    this.onEnd?.(played ? this.score : null);
  }
}
