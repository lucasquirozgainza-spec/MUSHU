// Almacenamiento y sincronización automática de la mascota (sin cuentas ni configuración).
//
// Modelo
//   - Cada teléfono guarda un "punto de partida" (base) y la lista completa de cambios (ops):
//     comer, acariciar, ropa, ajustes… Cada op lleva fecha, autor y un identificador único.
//   - El estado visible se calcula reaplicando todas las ops en orden de fecha sobre la base,
//     con las mismas reglas en los dos teléfonos (rules.js). Así, aunque los cambios lleguen
//     en distinto orden, los dos llegan exactamente al mismo resultado, y una op repetida o
//     fuera de tiempo se descarta igual en ambos.
//
// Compartir
//   - El enlace de invitación contiene la base comprimida y un canal privado aleatorio, así que
//     tu pareja recibe la mascota completa al abrirlo aunque tú no estés conectado.
//   - Los cambios viajan por ntfy.sh (servicio abierto y gratuito, sin cuentas) por ese canal.
//     ntfy solo guarda los mensajes unas horas, por eso cada teléfono reenvía sus cambios hasta
//     que el otro confirma que los tiene: nada se pierde aunque no coincidáis conectados.

import { newPetState, applyAction, neglect, DEFAULT_SETTINGS, stageFor, ageInDays, localDay, dayDiff } from './rules.js';

const KEY = 'mascota.repl.v3';
const OLD_KEY = 'mascota.local.v1';
const ME_KEY = 'mascota.me.v1';
const DEV_KEY = 'mascota.device.v1';
const NTFY = 'https://ntfy.sh';
const POLL_MS = 15000;
const RESEND_MS = 3 * 60000;
const MAX_MSG = 3600;

const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const randomTopic = () => 'mushu-' + Array.from(crypto.getRandomValues(new Uint8Array(15)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const bytes = (s) => new TextEncoder().encode(s).length;

class RuleError extends Error { constructor(m) { super(m); this.rule = true; } }

// ---------------------------------------------------------------- operaciones
export function applyOp(data, op) {
  const pet = data.pet;
  const now = new Date(op.at);
  const who = pet.members.find((m) => m.id === op.by);
  const logIt = (action, item = null) => {
    data.log.unshift({ id: op.id, memberId: op.by, name: who?.name || '?', action, item, at: op.at });
    if (data.log.length > 400) data.log.length = 400;
  };
  switch (op.type) {
    case 'act': {
      try { data.pet = applyAction(pet, { action: op.action, item: op.item, memberId: op.by }, now).pet; }
      catch (e) { if (e.rule) throw new RuleError(e.message); throw e; }
      logIt(op.action, op.item);
      return;
    }
    case 'outfit': pet.state.outfit = op.outfit; logIt('outfit', Object.values(op.outfit).join(',')); return;
    case 'name': pet.name = op.name; return;
    case 'memberName': { const m = pet.members.find((x) => x.id === op.memberId); if (m) m.name = op.name; return; }
    case 'settings':
      if (op.birthDate) pet.birthDate = op.birthDate;
      if (op.settings) pet.settings = op.settings;
      if (op.streak != null) { pet.state.streak = Math.max(0, op.streak); pet.state.bestStreak = Math.max(pet.state.bestStreak, pet.state.streak); }
      return;
    case 'evolution':
      if (stageFor(ageInDays(pet, now), pet.state.careDaysTotal, pet.settings) >= op.stage && !pet.state.evolutions.some((e) => e.stage === op.stage)) {
        pet.state.evolutions.push({ stage: op.stage, at: op.at });
      }
      return;
    case 'movedOut': if (!pet.state.movedOutAt) pet.state.movedOutAt = op.day; return;
    case 'reset':
      pet.birthDate = op.birthDate;
      pet.state = { ...newPetState(now, pet.tz, op.streak || 0), outfit: pet.state.outfit || {} };
      logIt('reset');
      return;
    case 'game': logIt('game', String(op.score)); return;
    case 'joined': { if (who && !who.joinedAt) who.joinedAt = op.at; return; }
    default: return; // ops de versiones futuras: se ignoran
  }
}

const opOrder = (a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function migratePet(p) {
  p.settings = p.settings || structuredClone(DEFAULT_SETTINGS);
  const st = p.state;
  st.outfit = st.outfit || {}; st.togetherDays = st.togetherDays || 0;
  if (!('sleepUntil' in st)) st.sleepUntil = null;
  st.evolutions = st.evolutions || [];
  return p;
}

// Base compacta: lo necesario para que los dos teléfonos calculen lo mismo.
function trimBase(base) {
  const b = structuredClone(base);
  const today = localDay(new Date(), b.pet.tz);
  for (const d of Object.keys(b.pet.state.days || {})) if (dayDiff(d, today) > 40) delete b.pet.state.days[d];
  return b;
}

// ---------------------------------------------------------------- enlace
const b64url = (u8) => { let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function pipe(u8, stream) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer()); }

async function packBase(base) {
  const raw = new TextEncoder().encode(JSON.stringify({ pet: base.pet }));
  if (typeof CompressionStream !== 'undefined') { try { return 'z' + b64url(await pipe(raw, new CompressionStream('deflate-raw'))); } catch {} }
  return 'p' + b64url(raw);
}
async function unpackBase(s) {
  const kind = s[0], u8 = unb64url(s.slice(1));
  const raw = kind === 'z' ? await pipe(u8, new DecompressionStream('deflate-raw')) : u8;
  const j = JSON.parse(new TextDecoder().decode(raw));
  return { pet: migratePet(j.pet), log: [] };
}

// Extrae { topic, packed } de un enlace (o del #hash actual).
export function parseInvite(text) {
  const m = String(text || '').match(/[#&?]m=(mushu-[a-z0-9]{10,})~([A-Za-z0-9_-]+)/);
  return m ? { topic: m[1], packed: m[2] } : null;
}

// ---------------------------------------------------------------- ntfy
class Relay {
  constructor(topic) { this.topic = topic; }
  async poll(since) {
    let res;
    try { res = await fetch(`${NTFY}/${this.topic}/json?poll=1&since=${encodeURIComponent(since || 'all')}`, { cache: 'no-store' }); }
    catch { const e = new Error('Sin conexión.'); e.network = true; throw e; }
    if (!res.ok) { const e = new Error(`El canal compartido respondió ${res.status}.`); e.network = true; throw e; }
    const out = [];
    for (const line of (await res.text()).split('\n')) {
      if (!line.trim()) continue;
      try { const m = JSON.parse(line); if (m.event === 'message') out.push(m); } catch {}
    }
    return out;
  }
  async publish(obj) {
    let res;
    try { res = await fetch(`${NTFY}/${this.topic}`, { method: 'POST', body: JSON.stringify(obj) }); }
    catch { const e = new Error('Sin conexión.'); e.network = true; throw e; }
    if (!res.ok) { const e = new Error(`No se pudo enviar (${res.status}).`); e.network = true; throw e; }
  }
}

// ---------------------------------------------------------------- Store
export class Store {
  constructor() {
    this.listeners = new Set();
    this.repl = null;      // { v, topic, base, ops, lastMsg, ack, sentAt, haveSent }
    this.data = null;      // estado calculado { pet, log }
    this.meId = LS.get(ME_KEY);
    this.device = LS.get(DEV_KEY) || (() => { const d = uid(); LS.set(DEV_KEY, d); return d; })();
    this.status = 'local';
    this.lastError = '';
    this._syncing = null;
    window.addEventListener('online', () => this.sync());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sync(); });
  }

  get synced() { return !!this.repl?.topic; }
  get pet() { return this.data?.pet || null; }
  get pendingCount() { return this.repl ? this.repl.ops.filter((o) => o.dev === this.device && o.at > (this.repl.sentAt || '')).length : 0; }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(type, data) { for (const f of this.listeners) f(type, data); }
  _setStatus(s) { if (s !== this.status) { this.status = s; this._emit('status', s); } }
  _save() { LS.set(KEY, JSON.stringify(this.repl)); }

  // Recalcula el estado a partir de la base y todas las ops.
  _replay() {
    const data = structuredClone(this.repl.base);
    migratePet(data.pet);
    data.log = data.log || [];
    const rejected = new Map();
    for (const op of [...this.repl.ops].sort(opOrder)) {
      const backup = structuredClone(data.pet);
      try { applyOp(data, op); } catch (e) { data.pet = backup; rejected.set(op.id, e.message); }
    }
    this.data = data;
    return rejected;
  }

  async init() {
    try { this.repl = JSON.parse(LS.get(KEY) || 'null'); } catch { this.repl = null; }
    if (!this.repl) {
      // migrar la versión anterior (todo lo que ya teníais se conserva)
      let old = null;
      try { old = JSON.parse(LS.get(OLD_KEY) || 'null'); } catch {}
      if (old?.pet) {
        this.repl = { v: 3, topic: randomTopic(), base: trimBase({ pet: migratePet(old.pet), log: old.log || [] }), ops: [], lastMsg: null, ack: '', sentAt: '' };
        this._save();
      }
    }
    if (!this.repl) return null;
    if (!this.repl.topic) { this.repl.topic = randomTopic(); this._save(); }
    this._replay();
    if (!this.meId || !this.pet.members.some((m) => m.id === this.meId)) {
      if (!this.repl.joined) this.setMe(this.pet.members[0].id);
    }
    this._checkMovedOut();
    this.sync();
    this._startPolling();
    return this.pet;
  }

  needsIdentity() { return !!this.data && (!this.meId || !this.data.pet.members.some((m) => m.id === this.meId)); }
  setMe(id) { this.meId = id; LS.set(ME_KEY, id); }

  _checkMovedOut() {
    const n = neglect(this.data.pet, new Date());
    if (n.movedOut && !this.data.pet.state.movedOutAt) this._op({ type: 'movedOut', day: n.movedOutDay });
  }

  async createPet({ name, birthDate, myName, partnerName, streak = 0 }) {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/La_Paz';
    const a = { id: uid(), name: myName }, b = { id: uid(), name: partnerName || 'Pareja' };
    const pet = migratePet({ id: uid(), name, birthDate, tz, settings: structuredClone(DEFAULT_SETTINGS), state: newPetState(now, tz, streak), members: [a, b] });
    this.repl = { v: 3, topic: randomTopic(), base: { pet, log: [] }, ops: [], lastMsg: null, ack: '', sentAt: '' };
    this.setMe(a.id);
    this._replay(); this._save();
    this.sync(); this._startPolling();
    return this.pet;
  }

  // Enlace para la pareja (contiene la base comprimida y el canal).
  async inviteUrl() {
    if (!this.repl) return '';
    if (!this._packed || this._packedFor !== this.repl.base) { this._packed = await packBase(this.repl.base); this._packedFor = this.repl.base; }
    return `${location.origin}${location.pathname}#m=${this.repl.topic}~${this._packed}`;
  }

  // Abrir el enlace de la pareja en este teléfono.
  async joinFromLink(text) {
    const inv = parseInvite(text);
    if (!inv) throw new Error('No reconozco ese enlace. Ábrelo directamente desde el mensaje de tu pareja.');
    if (this.repl?.topic === inv.topic) return this.pet;
    let base;
    try { base = await unpackBase(inv.packed); } catch { throw new Error('El enlace está incompleto. Pide a tu pareja que te lo envíe de nuevo.'); }
    this.repl = { v: 3, topic: inv.topic, base, ops: [], lastMsg: null, ack: '', sentAt: '', joined: true };
    this.meId = null; LS.del(ME_KEY);
    this._replay(); this._save();
    await this.sync().catch(() => {});
    this._startPolling();
    return this.pet;
  }

  // ---- cambios ----
  _op(partial) {
    if (!this.repl) return Promise.resolve({ ok: false, reason: 'Sin mascota.' });
    const op = { id: uid(), at: new Date().toISOString(), by: this.meId, dev: this.device, ...partial };
    this.repl.ops.push(op);
    const rejected = this._replay();
    if (rejected.has(op.id)) {
      this.repl.ops = this.repl.ops.filter((o) => o.id !== op.id);
      this._replay();
      return Promise.resolve({ ok: false, reason: rejected.get(op.id), pet: this.pet });
    }
    this._compact();
    this._save();
    this.sync();
    return Promise.resolve({ ok: true, pet: this.pet, op, pending: this.status === 'offline' });
  }

  // Muchos años de cambios: los de más de 120 días pasan a la base.
  _compact() {
    if (this.repl.ops.length < 4000) return;
    const cut = new Date(Date.now() - 120 * 86400000).toISOString();
    const old = this.repl.ops.filter((o) => o.at < cut);
    const keep = this.repl.ops.filter((o) => o.at >= cut);
    const saved = this.repl.ops;
    this.repl.ops = old; this._replay();
    this.repl.base = { pet: this.data.pet, log: this.data.log.slice(0, 200) };
    this.repl.ops = keep; this._replay();
    void saved;
  }

  // ---- sincronización ----
  sync() {
    if (!this.repl?.topic) return Promise.resolve();
    if (this._syncing) return this._syncing;
    this._syncing = this._doSync().finally(() => { this._syncing = null; });
    return this._syncing;
  }

  async _doSync() {
    const relay = new Relay(this.repl.topic);
    const r = this.repl;
    // 1) recibir
    let msgs;
    try { msgs = await relay.poll(r.lastMsg); }
    catch (e) { this.lastError = e.message; this._setStatus('offline'); return; }
    const known = new Set(r.ops.map((o) => o.id));
    const fresh = [];
    for (const m of msgs) {
      r.lastMsg = m.id;
      let p; try { p = JSON.parse(m.message); } catch { continue; }
      if (!p || p.d === this.device) continue;
      if (p.k === 'ops' && Array.isArray(p.ops)) {
        for (const op of p.ops) if (op && op.id && op.at && !known.has(op.id)) { known.add(op.id); r.ops.push(op); fresh.push(op); }
      }
      if (p.k === 'have' && p.up && p.up[this.device] && p.up[this.device] > (r.ack || '')) r.ack = p.up[this.device];
    }
    if (fresh.length) {
      const before = new Set(this.data.log.map((l) => l.id));
      this._replay();
      this._compact();
      this._save();
      const recent = Date.now() - 6 * 3600000;
      for (const l of [...this.data.log].reverse()) {
        if (!before.has(l.id) && l.memberId !== this.meId && new Date(l.at).getTime() > recent) this._emit('remote', l);
      }
      this._emit('pet', this.pet);
    } else this._save();

    // 2) enviar mis cambios que la pareja todavía no confirmó
    try {
      const mine = r.ops.filter((o) => o.dev === this.device && o.at > (r.ack || '')).sort(opOrder);
      const newest = mine.length ? mine[mine.length - 1].at : '';
      const due = mine.length && (newest > (r.sentAt || '') || Date.now() - (r.sentWall || 0) > RESEND_MS);
      if (due) {
        let chunk = [];
        const flush = async () => { if (chunk.length) { await relay.publish({ k: 'ops', d: this.device, ops: chunk }); chunk = []; } };
        for (const op of mine) {
          chunk.push(op);
          if (bytes(JSON.stringify({ k: 'ops', d: this.device, ops: chunk })) > MAX_MSG) { chunk.pop(); await flush(); chunk.push(op); }
        }
        await flush();
        r.sentAt = newest; r.sentWall = Date.now();
      }
      // confirmar lo que yo tengo de la pareja
      const up = {};
      for (const o of r.ops) if (o.dev && o.dev !== this.device && (!up[o.dev] || o.at > up[o.dev])) up[o.dev] = o.at;
      const sig = JSON.stringify(up);
      if (Object.keys(up).length && (sig !== r.haveSig || Date.now() - (r.haveWall || 0) > 10 * 60000)) {
        await relay.publish({ k: 'have', d: this.device, up });
        r.haveSig = sig; r.haveWall = Date.now();
      }
      this._save();
      this.lastError = '';
      this._setStatus('online');
    } catch (e) { this.lastError = e.message; this._setStatus('offline'); }
  }

  _startPolling() {
    clearInterval(this._timer);
    this._timer = setInterval(() => { if (!document.hidden) this.sync(); }, POLL_MS);
  }

  // ---- API usada por la interfaz ----
  act(action, item = null) { return this._op({ type: 'act', action, item }); }
  setOutfit(outfit) { return this._op({ type: 'outfit', outfit }); }
  updatePet({ name, birthDate, settings, streak }) {
    if (name) return this._op({ type: 'name', name });
    return this._op({ type: 'settings', birthDate, settings, streak });
  }
  setMemberName(memberId, name) { return this._op({ type: 'memberName', memberId, name }); }
  recordEvolution(stage) { return this._op({ type: 'evolution', stage }); }
  resetPet(birthDate, streak = 0) { return this._op({ type: 'reset', birthDate, streak }); }
  logGame(score) { return this._op({ type: 'game', score }); }
  markJoined() { const m = this.pet?.members.find((x) => x.id === this.meId); return m && !m.joinedAt ? this._op({ type: 'joined' }) : Promise.resolve({ ok: true }); }
  history() { return this.data?.log || []; }
  exportData() { return JSON.stringify(this.repl, null, 1); }
  async importData(json) {
    const d = JSON.parse(json);
    if (d?.v === 3 && d.base?.pet) this.repl = { ...d, lastMsg: null, sentAt: '', ack: '' };
    else if (d?.pet?.state) this.repl = { v: 3, topic: this.repl?.topic || randomTopic(), base: trimBase({ pet: migratePet(d.pet), log: d.log || [] }), ops: [], lastMsg: null, ack: '', sentAt: '' };
    else throw new Error('El archivo no es una copia válida.');
    this._replay();
    if (!this.pet.members.some((m) => m.id === this.meId)) this.setMe(this.pet.members[0].id);
    this._save(); this.sync();
    return this.pet;
  }
}
