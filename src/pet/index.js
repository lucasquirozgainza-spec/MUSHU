// Componente reutilizable de la mascota: crea el SVG, el rig, las partículas y el animador,
// gestiona el bucle de animación y la interacción táctil/ratón (tocar, acariciar, mirada).

import { PetRig } from './rig.js';
import { FX } from './fx.js';
import { Animator } from './animator.js';
import { STAGES, stageById } from './stages.js';
import { rand, pick } from './math.js';
import { Scene } from './scene.js';
import { ACTIVITY_NAMES } from './activities.js';

const NS = 'http://www.w3.org/2000/svg';

export class PetView {
  constructor(container, { stage = 1, interactive = true, viewBox = '-30 -78 350 373', scene = true, activities = false } = {}) {
    this.container = container;
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('viewBox', viewBox);
    this.svg.setAttribute('class', 'pet-svg');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'Mascota animada');
    container.appendChild(this.svg);
    this.stage = stageById(stage);
    this.rig = new PetRig(this.svg, this.stage.palette);
    this.rig.setForm(this.stage.form);
    this.fx = new FX(this.rig.fxLayer, this.rig.defs, this.rig.id);
    this.anim = new Animator(this.rig, this.fx);
    if (scene) { this.scene = new Scene(this.svg, this.rig); this.anim.scene = this.scene; }
    // actividades propias: a veces lo pillas jugando, leyendo, con el móvil o con el autito
    this.activities = activities;
    this.nextActivity = activities ? rand(25, 50) : Infinity;
    this.calm = 0; // segundos sin acciones
    this.ambientT = 0;
    this._last = performance.now();
    this._raf = null;
    this._visible = true;
    this._loop = this._loop.bind(this);
    this._onVis = () => { this._visible = !document.hidden; this._last = performance.now(); };
    document.addEventListener('visibilitychange', this._onVis);
    if (interactive) this._bindPointer();
    this.anim.update(0.016);
    this.start();
  }

  start() { if (!this._raf) { this._last = performance.now(); this._raf = requestAnimationFrame(this._loop); } }
  stop() { cancelAnimationFrame(this._raf); this._raf = null; }

  _loop(now) {
    this._raf = requestAnimationFrame(this._loop);
    if (!this._visible) return;
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.anim.update(dt);
    this._ambient(dt);
    this._activityTick(dt);
  }

  _ambient(dt) {
    const kind = this.stage.ambient;
    if (!kind) return;
    this.ambientT += dt;
    const every = kind === 'bubbles' ? 0.7 : 0.45;
    if (this.ambientT > every) {
      this.ambientT = 0;
      const x = rand(60, 240), y = rand(150, 260);
      if (kind === 'bubbles') this.fx.bubble(x, y);
      else this.fx.ember(x, y, Math.random() < 0.5 ? '#fff2a0' : '#ffb347');
    }
  }

  _activityTick(dt) {
    if (!this.activities) return;
    if (this.anim.action || this.paused) { this.calm = 0; return; }
    this.calm += dt;
    if (this.calm > this.nextActivity) { this.startActivity(); }
  }

  // Empieza una actividad (o una al azar). Devuelve el nombre o null.
  startActivity(name) {
    const mood = this.anim.mood;
    if (mood === 'sad' || mood === 'sleepy') { this.nextActivity = this.calm + rand(30, 60); return null; }
    const choice = name || pick(ACTIVITY_NAMES.filter((n) => n !== this._lastActivity));
    const r = this.anim.request(choice);
    this.nextActivity = rand(45, 110);
    this.calm = 0;
    if (r.ok) { this._lastActivity = choice; this.onActivity?.(choice); return choice; }
    return null;
  }

  // Te ve llegar mientras hace algo: se sorprende (y suelta lo que tenía).
  noticeYou() {
    if (!this.anim.activity) return false;
    return this.anim.request('caught').ok;
  }

  // Dormir en la cama. `already` = ya estaba durmiendo al abrir la app (sin animación de acostarse).
  sleepInBed(already = false) {
    if (already) { this.anim._start('bedLoop', {}, true); return { ok: true }; }
    return this.anim.request('goToBed');
  }
  wakeFromBed() { return this.anim.request('wakeFromBed'); }

  setOutfit(outfit) { this.rig.setOutfit(outfit || {}); }

  setStage(id) {
    this.stage = stageById(id);
    this.rig.setPalette(this.stage.palette);
    this.rig.setForm(this.stage.form);
  }

  // Secuencia de evolución hacia la etapa `id`. Devuelve una promesa al terminar.
  evolveTo(id) {
    const from = this.stage.palette, fromForm = this.stage.form, toStage = stageById(id);
    return new Promise((resolve) => {
      const off = this.anim.on('actionEnd', (e) => { if (e.name === 'evolve') { off(); resolve(); } });
      this.anim.request('evolve', {
        // el color y la forma cambian juntos mientras el cuerpo está iluminado
        onMix: (k) => {
          if (k > 0 && k < 1) { this.rig.mixPalette(from, toStage.palette, k); this.rig.mixForm(fromForm, toStage.form, k); }
          else if (k >= 1 && this.stage !== toStage) { this.stage = toStage; this.rig.setPalette(toStage.palette); this.rig.setForm(toStage.form); }
        },
      });
    });
  }

  feed(food, onConsumed) { return this.anim.request('eat', { food, onConsumed }); }
  act(name, opts) { return this.anim.request(name, opts); }
  setMood(m) { this.anim.setMood(m); }

  // ---------- puntero ----------
  _toSvg(e) {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = this.svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }

  _hit(p) {
    const local = this.rig.toLocal([p.x, p.y]);
    const dp = this.svg.createSVGPoint(); dp.x = local[0]; dp.y = local[1];
    try { return this.rig.bodyPath.isPointInFill(dp) ? local : null; } catch { return null; }
  }

  _bindPointer() {
    const svg = this.svg;
    svg.style.touchAction = 'none';
    let down = null;
    svg.addEventListener('pointermove', (e) => {
      const p = this._toSvg(e);
      const local = this.rig.toLocal([p.x, p.y]);
      if (e.pointerType === 'mouse' || down) this.anim.setPointer(local[0], local[1]);
      if (!down) return;
      const dx = p.x - down.x, dy = p.y - down.y;
      down.dist += Math.hypot(p.x - down.lx, p.y - down.ly);
      down.lx = p.x; down.ly = p.y;
      if (!down.petting && down.onBody && down.dist > 22) {
        const r = this.anim.request('pet');
        down.petting = r.ok;
        if (r.ok) this.onInteract?.('pet', r);
      }
      if (down.petting) this.anim.petDX = this.anim.petDX * 0.8 + dx * 0.2;
    });
    svg.addEventListener('pointerdown', (e) => {
      const p = this._toSvg(e);
      if (this.scene && this.scene.hitBall(p.x, p.y) && !this.anim.inBed) {
        const b = this.scene.ball;
        if (!b.held) {
          this.scene.kick(p.x < b.x ? 1 : -1, 1);
          this.anim.setPointer(b.x, b.y - 60);
          if (!this.anim.action) this.anim.request('browRaise');
          this.onInteract?.('ball', { ok: true });
        }
        return;
      }
      const local = this._hit(p);
      down = { x: p.x, y: p.y, lx: p.x, ly: p.y, t: performance.now(), dist: 0, onBody: !!local, local, petting: false };
      if (local) svg.setPointerCapture?.(e.pointerId);
    });
    const end = () => {
      if (!down) return;
      if (down.petting) { this.anim.release('pet'); this.anim.petDX = 0; }
      else if (down.onBody && down.dist < 12 && performance.now() - down.t < 450) {
        const r = this.anim.request('poke', { x: down.local[0], y: down.local[1] });
        this.onInteract?.('poke', r);
      }
      down = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.anim.clearPointer(); });
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this._onVis);
    this.svg.remove();
  }
}

export { STAGES };
