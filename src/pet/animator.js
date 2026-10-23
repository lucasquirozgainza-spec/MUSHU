// Animador: máquina de estados + capas de mezcla.
//
//   pose final = expresión del estado de ánimo (muelles)
//              + capa de reposo procedural (respiración, balanceo, parpadeo, mirada)
//              + gesto de reposo (clip de prioridad baja)
//              + acción (clip de prioridad alta, con fundido cruzado)
//
// Reglas de coordinación:
//  - Una acción no interrumpible (comer, dormirse, despertar, evolucionar) no se corta:
//    las peticiones se encolan (máx. 1) o se rechazan con un motivo.
//  - Dormido: solo se aceptan despertar, tocar (despierta de mal humor) y acariciar.
//  - Evolucionar tiene prioridad máxima y cancela cualquier otra cosa.
//  - Los estados de ánimo nunca interrumpen acciones: solo cambian la expresión base.

import { DEFAULT_POSE } from './rig.js';
import { CLIPS } from './clips.js';
import { ACTIVITY_CLIPS } from './activities.js';

Object.assign(CLIPS, ACTIVITY_CLIPS);
import { MOODS } from './expressions.js';
import { clamp, lerp, damp, rand, pick, makeNoise } from './math.js';

const EXPR_KEYS = [...new Set(Object.values(MOODS).flatMap((m) => Object.keys(m.expr)))];

export class Animator {
  constructor(rig, fx) {
    this.rig = rig;
    this.fx = fx;
    this.time = 0;
    this.idleT = 0;
    this.mood = 'neutral';
    this.expr = {};
    for (const k of EXPR_KEYS) this.expr[k] = MOODS.neutral.expr[k] ?? DEFAULT_POSE[k];
    this.action = null;
    this.fading = [];
    this.fidget = null;
    this.queue = [];
    this.listeners = {};
    this.noise = [makeNoise(11), makeNoise(23), makeNoise(37), makeNoise(51)];
    this.look = [-0.72, 0.12];
    this.gazeTarget = [-0.72, 0.12];
    this.nextSaccade = 1.5;
    this.nextBlink = 1.2;
    this.blinkT = -1;
    this.blinkDur = 0.16;
    this.doubleBlink = false;
    this.nextFidget = rand(4, 7);
    this.pointer = null;
    this.petDX = 0;
    this.sleepPet = 0;
    this.pose = { ...DEFAULT_POSE };
    this.timeScale = 1;
  }

  // ---------- eventos ----------
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this.listeners[ev] = (this.listeners[ev] || []).filter((f) => f !== fn); }
  emit(ev, data) { for (const f of this.listeners[ev] || []) f(data); }

  get state() {
    if (this.action?.def.state) return this.action.def.state;
    if (this.action) return this.action.name;
    return 'idle';
  }
  get isSleeping() { return ['sleepLoop', 'fallAsleep', 'goToBed', 'bedLoop', 'stir'].includes(this.action?.name); }
  get inBed() { return ['goToBed', 'bedLoop', 'stir'].includes(this.action?.name); }
  get activity() { return this.action?.def.activity ? this.action.name : null; }
  get busy() { return !!this.action && !this.action.def.interruptible; }

  // ---------- API ----------
  setMood(m) {
    if (!MOODS[m] || m === this.mood) return;
    const prev = this.mood;
    this.mood = m;
    this.nextFidget = Math.min(this.nextFidget, this.idleT + rand(1.5, 3));
    if (prev === 'sad' && m !== 'sad' && m !== 'sleepy') this.request('recover');
    this.emit('mood', m);
  }

  setPointer(x, y) { this.pointer = { x, y, t: this.time }; }
  clearPointer() { this.pointer = null; }

  // Devuelve { ok, reason?, queued? }
  request(name, opts = {}) {
    const def = CLIPS[name];
    if (!def) return { ok: false, reason: 'unknown' };
    const cur = this.action;

    if (name === 'evolve') { this._start(name, opts, true); return { ok: true }; }

    // En la cama: duerme de verdad. Tocarlo solo hace que se mueva un poco; despierta cuando
    // pasa el tiempo de descanso (lo pide la app con 'wakeFromBed').
    if (this.inBed) {
      if (name === 'wakeFromBed') { if (cur?.name === 'bedLoop' || cur?.name === 'stir') { this._start('wakeFromBed', opts, true); return { ok: true }; } return { ok: false, reason: 'busy' }; }
      if (name === 'poke') { if (cur?.name === 'bedLoop') this._start('stir', opts, true); return { ok: false, reason: 'sleeping' }; }
      if (name === 'pet') { this.sleepPet = 1; return { ok: true, sleeping: true }; }
      return { ok: false, reason: 'sleeping' };
    }
    if (this.isSleeping) {
      if (name === 'wake' || name === 'wakeUp') { if (cur?.name === 'sleepLoop') { this._start('wakeUp', opts, true); return { ok: true }; } return { ok: false, reason: 'busy' }; }
      if (name === 'poke') { if (cur?.name === 'sleepLoop') { this._start('wakeGrumpy', opts, true); return { ok: true, woke: true }; } return { ok: false, reason: 'busy' }; }
      if (name === 'pet') { this.sleepPet = 1; return { ok: true, sleeping: true }; }
      return { ok: false, reason: 'sleeping' };
    }
    if (name === 'wakeUp' || name === 'wake' || name === 'wakeFromBed') return { ok: false, reason: 'awake' };

    if (cur && !cur.def.interruptible) {
      // no se corta: se encola (solo la última petición) — salvo acciones sin sentido en cola
      if (def.priority >= 2 && name !== 'poke' && name !== 'pet') {
        this.queue = [{ name, opts }];
        return { ok: true, queued: true };
      }
      return { ok: false, reason: 'busy' };
    }
    if (cur && cur.def.priority > def.priority) return { ok: false, reason: 'busy' };
    // tocar varias veces seguidas → cosquillas
    if (name === 'poke') {
      this._pokes = (this._pokes || []).filter((t) => this.time - t < 3.5);
      this._pokes.push(this.time);
      if (this._pokes.length >= 4) { this._pokes = []; name = 'giggle'; }
    }
    this._start(name, opts, true);
    return { ok: true, clip: name };
  }

  // Termina un clip sostenido (acariciar)
  release(name) {
    if (name === 'pet') this.sleepPet = 0;
    if (this.action?.name === name && this.action.def.hold) this.action.releasing = this.action.t;
  }

  // ---------- interno ----------
  _instance(name, opts) {
    const def = CLIPS[name];
    const inst = { name, def, t: 0, opts, d: {}, fired: new Set(), everyT: {}, releasing: null };
    inst.ctx = { anim: this, rig: this.rig, fx: this.fx, scene: this.scene, def, opts, get d() { return inst.d; }, get pose() { return inst.pose; } };
    inst.pose = this.pose;
    if (def.init) inst.d = def.init(inst.ctx) || {};
    return inst;
  }

  _start(name, opts, interrupt) {
    if (this.action) {
      if (interrupt) {
        this.fading.push({ inst: this.action, w0: this._weight(this.action), t: 0, dur: 0.22 });
        if (this.action.def.end) this.action.def.end(this.action.ctx);
      }
    }
    if (this.fidget) { this.fading.push({ inst: this.fidget, w0: this._weight(this.fidget), t: 0, dur: 0.2 }); this.fidget = null; }
    this.action = this._instance(name, opts);
    this.emit('action', { name, opts });
  }

  _weight(inst) {
    const d = inst.def;
    let w = d.fadeIn ? Math.min(1, inst.t / d.fadeIn) : 1;
    if (inst.releasing !== null) w *= clamp(1 - (inst.t - inst.releasing) / (d.fadeOut || 0.3), 0, 1);
    else if (!d.loop && !d.hold) w *= clamp((d.duration - inst.t) / (d.fadeOut || 0.01), 0, 1);
    return w;
  }

  _done(inst) {
    const d = inst.def;
    if (inst.releasing !== null) return inst.t - inst.releasing >= (d.fadeOut || 0.3);
    if (d.loop || d.hold) return false;
    return inst.t >= d.duration;
  }

  _runEvents(inst, dt) {
    const d = inst.def;
    if (d.events) for (const [et, fn] of d.events) if (inst.t >= et && !inst.fired.has(et)) { inst.fired.add(et); fn(inst.ctx); }
    if (d.every) for (const [iv, fn] of d.every) {
      inst.everyT[iv] = (inst.everyT[iv] ?? iv * 0.5) + dt;
      if (inst.everyT[iv] >= iv) { inst.everyT[iv] -= iv; fn(inst.ctx, inst.t); }
    }
  }

  _apply(pose, inst, w) {
    if (w <= 0) return;
    inst.pose = pose;
    const o = inst.def.sample(inst.t, inst.ctx);
    for (const k in o) {
      if (!(k in pose)) continue;
      if (k.endsWith('_front')) { if (w > 0.5) pose[k] = o[k]; continue; }
      pose[k] = lerp(pose[k], o[k], w);
    }
    return o;
  }

  _idle(pose, dt) {
    const m = MOODS[this.mood];
    const t = this.idleT;
    const n = this.noise;
    // respiración
    const period = 3.6 / Math.max(0.5, m.tempo);
    pose.breathe = 0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2);
    pose.squash += (pose.breathe - 0.5) * 0.014;
    // balanceo y micro-movimientos de cabeza
    pose.lean += n[0](t * 0.35) * 0.028 * m.energy;
    pose.x += n[1](t * 0.22) * 1.4;
    pose.turn += n[2](t * 0.3) * 0.22;
    pose.browR_raise += n[3](t * 0.4) * 1.2;
    pose.browL_raise += n[3](t * 0.33 + 4) * 0.8;
    // los brazos acompañan la respiración
    pose.armL_a1 += (pose.breathe - 0.5) * 0.05 + n[1](t * 0.5 + 2) * 0.03;
    pose.armR_a1 += (pose.breathe - 0.5) * 0.05 + n[2](t * 0.45 + 5) * 0.03;

    // parpadeo con intervalos variables (dobles a veces)
    if (this.blinkT < 0 && this.time >= this.nextBlink) {
      this.blinkT = 0;
      this.blinkDur = this.mood === 'sleepy' ? rand(0.35, 0.6) : rand(0.14, 0.19);
    }
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const u = this.blinkT / this.blinkDur;
      blink = u < 0.4 ? u / 0.4 : u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;
      if (u >= 1) {
        this.blinkT = -1;
        blink = 0;
        if (!this.doubleBlink && Math.random() < 0.2) { this.doubleBlink = true; this.nextBlink = this.time + 0.12; }
        else { this.doubleBlink = false; this.nextBlink = this.time + (this.mood === 'sleepy' ? rand(1.2, 3) : rand(1.8, 5.5)); }
      }
    }
    pose.blink = clamp(blink, 0, 1);

    // mirada: puntero reciente > objetivo aleatorio (sacadas)
    if (this.pointer && this.time - this.pointer.t < 2.5) {
      const dx = this.pointer.x - 156, dy = this.pointer.y - 160;
      this.gazeTarget = [clamp(dx / 90, -1, 1), clamp(dy / 110, -0.9, 0.9)];
    } else if (this.idleT >= this.nextSaccade) {
      const home = m.gazeHome;
      this.gazeTarget = Math.random() < 0.55 ? [home[0] + rand(-0.08, 0.08), home[1] + rand(-0.05, 0.05)] : [rand(-0.9, 0.9), rand(-0.5, 0.55)];
      this.nextSaccade = this.idleT + rand(1.2, 3.6);
    }
    pose.lookX = this.gazeTarget[0];
    pose.lookY = this.gazeTarget[1];
  }

  update(dt) {
    dt = Math.min(dt, 0.05) * this.timeScale;
    this.time += dt;
    const m = MOODS[this.mood];
    this.idleT += dt * m.tempo;

    // 1) expresión base con muelles
    const sm = 0.35;
    for (const k of EXPR_KEYS) {
      const target = m.expr[k] ?? DEFAULT_POSE[k];
      this.expr[k] = damp(this.expr[k], target, sm, dt);
    }
    const pose = { ...DEFAULT_POSE, ...this.expr };
    this.pose = pose;

    // 2) reposo procedural
    this._idle(pose, dt);

    // 3) gesto de reposo (solo sin acción)
    if (!this.action && !this.fidget && this.idleT >= this.nextFidget) {
      const name = pick(m.fidgets);
      this.fidget = this._instance(name, {});
      this.nextFidget = this.idleT + rand(5, 11);
    }
    if (this.fidget) {
      this.fidget.t += dt;
      this._apply(pose, this.fidget, this._weight(this.fidget));
      this._runEvents(this.fidget, dt);
      if (this._done(this.fidget)) this.fidget = null;
    }

    // 4) acciones que se están desvaneciendo (fundido cruzado)
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      f.t += dt; f.inst.t += dt;
      const w = f.w0 * (1 - f.t / f.dur);
      if (w <= 0) { this.fading.splice(i, 1); continue; }
      this._apply(pose, f.inst, w);
    }

    // 5) acción actual
    if (this.action) {
      const a = this.action;
      a.t += dt;
      this._apply(pose, a, this._weight(a));
      this._runEvents(a, dt);
      if (this._done(a)) {
        if (a.def.end) a.def.end(a.ctx);
        this.action = null;
        this.emit('actionEnd', { name: a.name, opts: a.opts });
        if (a.def.next) this.action = this._instance(a.def.next, a.opts);
        else if (this.queue.length) { const q = this.queue.shift(); this.request(q.name, q.opts); }
        if (!this.action) this.nextFidget = this.idleT + rand(2.5, 6);
      }
    }

    // 6) suavizado final de la mirada (sacadas rápidas pero sin saltos)
    this.look[0] = damp(this.look[0], pose.lookX, 0.07, dt);
    this.look[1] = damp(this.look[1], pose.lookY, 0.07, dt);
    pose.lookX = this.look[0];
    pose.lookY = this.look[1];

    // 7) las cejas acompañan todo: suben al mirar arriba, al estirarse y al sonreír,
    //    bajan al encogerse y al parpadear, y rebotan con los saltos.
    const lift = -pose.lookY * 2.4 - pose.squash * 26 + Math.max(0, pose.mouthCurve) * 1.6 + pose.mouthOpen * 2.2 - pose.blink * 1.2 - (pose.y < -1 ? pose.y * 0.12 : 0);
    const browK = pose.lie > 0.5 ? 0.3 : 1;
    pose.browL_raise += lift * browK;
    pose.browR_raise += lift * 0.8 * browK;
    pose.browL_inner += pose.irisScale > 1.04 ? (pose.irisScale - 1) * 30 : 0;

    this.rig.render(pose, this.time, dt);
    this.scene?.update(dt, this.time, pose);
    this.fx.update(dt);
  }
}
