// Almacenamiento de la mascota.
//
// - Siempre guarda en este navegador (funciona sin configurar nada).
// - Compartido automático: al crear la mascota se guarda una copia en jsonblob.com (gratis, sin
//   cuentas) y la pareja entra con un enlace. Plan B: un repositorio de GitHub con token.
//   Cada cambio es una operación (op) que se aplica
//   sobre la versión más reciente del archivo: si los dos tocan a la vez, se reintenta sobre
//   la versión nueva y no se pierde nada. Sin Internet, las ops quedan pendientes.

import { newPetState, applyAction, neglect, DEFAULT_SETTINGS, stageFor, ageInDays } from './rules.js';

const KEY = 'mascota.local.v1';
const SYNC_KEY = 'mascota.sync.v1';
const ME_KEY = 'mascota.me.v1';
const PENDING_KEY = 'mascota.pending.v2';
const API = 'https://api.github.com';
const POLL_MS = 15000;

const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const b64encode = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); };
const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

class RuleError extends Error { constructor(m) { super(m); this.rule = true; } }

// ---------------------------------------------------------------- operaciones
// Cada op es serializable para poder guardarla pendiente y reaplicarla sobre la versión remota.
export function applyOp(data, op) {
  const pet = data.pet;
  const now = new Date(op.at);
  const who = pet.members.find((m) => m.id === op.by);
  const logIt = (action, item = null) => {
    data.log.unshift({ id: op.id, memberId: op.by, name: who?.name || '?', action, item, at: op.at });
    data.log = data.log.slice(0, 400);
  };
  switch (op.type) {
    case 'act': {
      if (data.log.some((l) => l.id === op.id)) return; // ya aplicada
      try {
        const r = applyAction(pet, { action: op.action, item: op.item, memberId: op.by }, now);
        data.pet = r.pet;
      } catch (e) { if (e.rule) throw new RuleError(e.message); throw e; }
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
    case 'reset': {
      pet.birthDate = op.birthDate;
      pet.state = { ...newPetState(now, pet.tz, op.streak || 0), outfit: pet.state.outfit || {} };
      logIt('reset');
      return;
    }
    case 'game': logIt('game', String(op.score)); return;
    case 'joined': { const m = pet.members.find((x) => x.id === op.by); if (m && !m.joinedAt) m.joinedAt = op.at; return; }
    default: throw new Error('Operación desconocida');
  }
}

function migrate(data) {
  data.v = data.v || 1;
  data.log = data.log || [];
  const p = data.pet;
  p.settings = p.settings || structuredClone(DEFAULT_SETTINGS);
  const st = p.state;
  st.outfit = st.outfit || {}; st.togetherDays = st.togetherDays || 0;
  if (!('sleepUntil' in st)) st.sleepUntil = null;
  st.evolutions = st.evolutions || [];
  return data;
}

// ---------------------------------------------------------------- GitHub
class GitHub {
  constructor({ owner, repo, token, branch = 'datos', path = 'mushu.json' }) {
    Object.assign(this, { owner, repo, token, branch, path });
  }
  async _req(method, url, body) {
    let res;
    try {
      res = await fetch(API + url, {
        method, cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { const e = new Error('Sin conexión con GitHub.'); e.network = true; throw e; }
    if (res.status === 401) throw new Error('El token de GitHub no es válido o caducó.');
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') { const e = new Error('GitHub pide esperar unos minutos (límite de uso).'); e.network = true; throw e; }
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, json };
  }
  async check() {
    const r = await this._req('GET', `/repos/${this.owner}/${this.repo}`);
    if (r.status === 404) throw new Error(`No encuentro el repositorio ${this.owner}/${this.repo}, o el token no tiene acceso a él.`);
    if (r.status !== 200) throw new Error('GitHub respondió con un error al comprobar el repositorio.');
    if (r.json.permissions && !r.json.permissions.push) throw new Error('El token no tiene permiso de escritura (Contents: Read and write).');
    return r.json;
  }
  async ensureBranch() {
    const r = await this._req('GET', `/repos/${this.owner}/${this.repo}/git/ref/heads/${this.branch}`);
    if (r.status === 200) return;
    const repo = await this.check();
    const base = await this._req('GET', `/repos/${this.owner}/${this.repo}/git/ref/heads/${repo.default_branch}`);
    if (base.status !== 200) throw new Error('No pude leer la rama principal del repositorio. ¿Tiene algún archivo subido?');
    const c = await this._req('POST', `/repos/${this.owner}/${this.repo}/git/refs`, { ref: `refs/heads/${this.branch}`, sha: base.json.object.sha });
    if (c.status !== 201 && c.status !== 422) throw new Error('No pude crear la rama de datos en GitHub.');
  }
  async read() {
    const r = await this._req('GET', `/repos/${this.owner}/${this.repo}/contents/${this.path}?ref=${this.branch}&_=${Date.now()}`);
    if (r.status === 404) return null;
    if (r.status !== 200) throw new Error('No pude leer los datos en GitHub.');
    return { sha: r.json.sha, data: JSON.parse(b64decode(r.json.content)) };
  }
  async write(data, sha, message) {
    const r = await this._req('PUT', `/repos/${this.owner}/${this.repo}/contents/${this.path}`, {
      message, branch: this.branch, content: b64encode(JSON.stringify(data, null, 1)), ...(sha ? { sha } : {}),
    });
    if (r.status === 200 || r.status === 201) return r.json.content.sha;
    if (r.status === 409 || r.status === 422) return null; // alguien guardó antes: reintentar
    throw new Error('No pude guardar en GitHub.');
  }
}

// ---------------------------------------------------------------- jsonblob (automático)
const BLOB = 'https://jsonblob.com/api/jsonBlob';
class JsonBlob {
  constructor({ id }) { this.id = id; this.kind = 'blob'; }
  static async _fetch(url, opts = {}) {
    try {
      return await fetch(url, { cache: 'no-store', ...opts, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) } });
    } catch { const e = new Error('Sin conexión con el servidor compartido.'); e.network = true; throw e; }
  }
  static async create(data) {
    const res = await JsonBlob._fetch(BLOB, { method: 'POST', body: JSON.stringify({ ...data, rev: 1 }) });
    if (!res.ok) throw new Error('No se pudo crear el espacio compartido.');
    const loc = res.headers.get('Location') || res.headers.get('X-jsonblob') || res.headers.get('x-jsonblob-id') || '';
    const id = loc.split('/').filter(Boolean).pop();
    if (!id) throw new Error('El servicio compartido no devolvió el identificador.');
    return id;
  }
  async check() { const r = await this.read(); if (!r) throw new Error('Ese enlace ya no existe. Pide a tu pareja que te envíe uno nuevo.'); }
  async ensureBranch() {}
  async read() {
    const res = await JsonBlob._fetch(`${BLOB}/${this.id}`);
    if (res.status === 404) return null;
    if (!res.ok) { const e = new Error('No se pudieron leer los datos compartidos.'); e.network = res.status >= 500 || res.status === 429; throw e; }
    const data = await res.json();
    return { sha: String(data.rev || 0), data };
  }
  // Escribe y comprueba que nadie escribió a la vez; si lo hizo, devuelve null para reintentar.
  async write(data, sha) {
    const fresh = await this.read();
    if (fresh && String(fresh.data.rev || 0) !== String(sha || 0)) return null;
    const nonce = uid();
    const body = { ...data, rev: (+sha || 0) + 1, writer: nonce };
    const res = await JsonBlob._fetch(`${BLOB}/${this.id}`, { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) { const e = new Error('No se pudieron guardar los datos compartidos.'); e.network = true; throw e; }
    const check = await this.read();
    return check && check.data.writer === nonce ? String(body.rev) : null;
  }
}
const makeRemote = (cfg) => (cfg.kind === 'blob' ? new JsonBlob(cfg) : new GitHub(cfg));

// Enlace de invitación (modo automático).
export const inviteUrl = (cfg) => `${location.origin}${location.pathname}#mushu=${cfg.id}`;
export function blobFromUrl(text) {
  const m = String(text || '').match(/[#&?]mushu=([A-Za-z0-9-]{8,})/);
  return m ? { kind: 'blob', id: m[1] } : null;
}

// Código para que la pareja se conecte: incluye el repositorio y el token.
export const encodeLink = (cfg) => 'MUSHU-' + b64encode(JSON.stringify({ o: cfg.owner, r: cfg.repo, t: cfg.token })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
export function decodeLink(code) {
  const blob = blobFromUrl(code);
  if (blob) return blob;
  const s = code.trim().replace(/^MUSHU-/i, '').replace(/-/g, '+').replace(/_/g, '/');
  try { const j = JSON.parse(b64decode(s + '==='.slice((s.length + 3) % 4))); if (j.o && j.r && j.t) return { kind: 'github', owner: j.o, repo: j.r, token: j.t }; } catch {}
  throw new Error('No reconozco ese enlace o código. Ábrelo directamente desde el mensaje de tu pareja.');
}

// Si la web está en usuario.github.io/repositorio/, deduce el repositorio.
export function guessRepo() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (!m) return { owner: '', repo: '' };
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return { owner: m[1], repo: seg || `${m[1]}.github.io` };
}

// ---------------------------------------------------------------- Store
export class Store {
  constructor() {
    this.listeners = new Set();
    this.data = null;
    this.meId = LS.get(ME_KEY);
    const cfg = JSON.parse(LS.get(SYNC_KEY) || 'null');
    this.gh = cfg ? makeRemote(cfg) : null;
    this.sha = null;
    this.status = this.gh ? 'syncing' : 'local';
    this._busy = Promise.resolve();
    this._timer = null;
    window.addEventListener('online', () => this.sync());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sync(); });
  }

  get synced() { return !!this.gh; }
  get syncConfig() { return JSON.parse(LS.get(SYNC_KEY) || 'null'); }
  get pet() { return this.data?.pet || null; }
  get pendingCount() { return this._pending().length; }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(type, data) { for (const f of this.listeners) f(type, data); }
  _setStatus(s) { if (s !== this.status) { this.status = s; this._emit('status', s); } }
  _save() { LS.set(KEY, JSON.stringify(this.data)); }
  _pending() { try { return JSON.parse(LS.get(PENDING_KEY) || '[]'); } catch { return []; } }
  _setPending(list) { LS.set(PENDING_KEY, JSON.stringify(list)); }

  async init() {
    try { this.data = JSON.parse(LS.get(KEY) || 'null'); } catch { this.data = null; }
    if (this.data) migrate(this.data);
    if (this.gh) {
      await this.sync(true).catch(() => {});
      this._startPolling();
    }
    if (this.data && (!this.meId || !this.data.pet.members.some((m) => m.id === this.meId))) {
      if (!this.synced) this.setMe(this.data.pet.members[0].id);
    }
    if (this.data) this._checkMovedOut();
    if (this.data && !this.gh) this.autoShare();
    return this.pet;
  }

  needsIdentity() { return !!this.data && (!this.meId || !this.data.pet.members.some((m) => m.id === this.meId)); }
  setMe(id) { this.meId = id; LS.set(ME_KEY, id); }

  _checkMovedOut() {
    const n = neglect(this.data.pet, new Date());
    if (n.movedOut && !this.data.pet.state.movedOutAt) this._op({ type: 'movedOut', day: n.movedOutDay }).catch(() => {});
  }

  // Crea el espacio compartido automático (sin cuentas). Si falla, se reintenta más tarde.
  async autoShare() {
    if (this.gh || !this.data) return false;
    try {
      const id = await JsonBlob.create(this.data);
      const cfg = { kind: 'blob', id };
      LS.set(SYNC_KEY, JSON.stringify(cfg));
      this.gh = new JsonBlob(cfg);
      this.sha = '1';
      this._setStatus('online');
      this._startPolling();
      return true;
    } catch { this._setStatus('local'); return false; }
  }

  async createPet({ name, birthDate, myName, partnerName, streak = 0 }) {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/La_Paz';
    const a = { id: uid(), name: myName }, b = { id: uid(), name: partnerName || 'Pareja' };
    this.data = migrate({
      v: 2, log: [],
      pet: { id: uid(), name, birthDate, tz, settings: structuredClone(DEFAULT_SETTINGS), state: newPetState(now, tz, streak), members: [a, b] },
    });
    this.setMe(a.id);
    this._save();
    if (this.gh) await this._push('Mushu: nueva mascota').catch(() => {});
    else await this.autoShare();
    return this.pet;
  }

  // ---- cambios ----
  _op(partial) {
    const op = { id: uid(), at: new Date().toISOString(), by: this.meId, ...partial };
    // 1) aplicar en local al instante (la interfaz no espera a la red)
    const backup = structuredClone(this.data);
    try { applyOp(this.data, op); }
    catch (e) { this.data = backup; return Promise.resolve({ ok: false, reason: e.message, pet: this.pet }); }
    this._save();
    if (!this.gh) return Promise.resolve({ ok: true, pet: this.pet, op });
    // 2) enviar a GitHub en orden
    this._setPending([...this._pending(), op]);
    const run = this._busy.then(() => this._flush()).then(() => ({ ok: true, pet: this.pet, op }), (e) => {
      if (e.rule) return { ok: false, reason: e.message, pet: this.pet };
      return { ok: true, pending: true, pet: this.pet, op };
    });
    this._busy = run.catch(() => {});
    return run;
  }

  // Aplica las ops pendientes sobre la versión remota más reciente y la guarda.
  async _flush() {
    let pending = this._pending();
    if (!pending.length) return;
    this._setStatus('syncing');
    for (let attempt = 0; attempt < 4; attempt++) {
      let remote;
      try { remote = await this.gh.read(); } catch (e) { this._setStatus('offline'); throw e; }
      const base = remote ? migrate(remote.data) : structuredClone(this.data);
      const rejected = [];
      for (const op of pending) {
        try { applyOp(base, op); } catch (e) { if (e.rule) rejected.push({ op, e }); else throw e; }
      }
      let sha;
      try { sha = await this.gh.write(base, remote?.sha, `Mushu: ${pending.map((o) => o.action || o.type).join(', ')}`); }
      catch (e) { this._setStatus('offline'); throw e; }
      if (sha) {
        this.sha = sha;
        const mine = new Set(pending.map((o) => o.id));
        this._setPending(this._pending().filter((o) => !mine.has(o.id)));
        this._adopt(base, false);
        this._setStatus('online');
        if (rejected.length) throw new RuleError(rejected[0].e.message);
        return;
      }
      pending = this._pending();
    }
    this._setStatus('offline');
    throw new Error('Demasiados cambios a la vez, se reintentará.');
  }

  async _push(message) {
    await this.gh.ensureBranch();
    const remote = await this.gh.read();
    const sha = await this.gh.write(this.data, remote?.sha, message);
    if (sha) { this.sha = sha; this._setStatus('online'); }
  }

  _adopt(data, notify = true) {
    const prev = this.data;
    const seen = new Set((prev?.log || []).map((l) => l.id));
    this.data = migrate(data);
    // reaplicar en local lo que aún no se ha enviado
    for (const op of this._pending()) { try { applyOp(this.data, op); } catch {} }
    this._save();
    if (notify) {
      for (const l of [...this.data.log].reverse()) if (!seen.has(l.id) && l.memberId !== this.meId && prev) this._emit('remote', l);
      this._emit('pet', this.pet);
    }
  }

  // Trae la versión remota (y envía lo pendiente).
  async sync(first = false) {
    if (!this.gh) return;
    if (this._pending().length) { await this._busy; this._busy = this._flush().catch(() => {}); await this._busy; return; }
    try {
      const remote = await this.gh.read();
      this._setStatus('online');
      if (!remote) { if (this.data) await this._push('Mushu: primera copia'); return; }
      if (remote.sha !== this.sha) { this.sha = remote.sha; this._adopt(remote.data, !first); }
    } catch (e) { this._setStatus('offline'); if (!e.network) throw e; }
  }

  _startPolling() {
    clearInterval(this._timer);
    this._timer = setInterval(() => { if (!document.hidden) this.sync().catch(() => {}); }, POLL_MS);
  }

  // Conectar este dispositivo a GitHub. Devuelve 'pushed' (subió esta mascota) o 'adopted' (usó la que había).
  async connect(cfg, { prefer = 'remote' } = {}) {
    const gh = makeRemote(cfg);
    await gh.check();
    await gh.ensureBranch();
    const remote = await gh.read();
    LS.set(SYNC_KEY, JSON.stringify(cfg.kind === 'blob' ? { kind: 'blob', id: cfg.id } : { kind: 'github', owner: cfg.owner, repo: cfg.repo, token: cfg.token }));
    this.gh = gh;
    let result;
    if (remote && (prefer === 'remote' || !this.data)) {
      this.sha = remote.sha; this._adopt(remote.data, false); result = 'adopted';
    } else if (this.data) {
      const sha = await gh.write(this.data, remote?.sha, 'Mushu: conectar'); this.sha = sha; result = 'pushed';
    } else result = 'empty';
    this._setStatus('online');
    this._startPolling();
    return result;
  }

  async peekRemote(cfg) {
    const gh = makeRemote(cfg);
    await gh.check();
    const r = await gh.read().catch(() => null);
    return r?.data?.pet || null;
  }

  disconnect() { LS.del(SYNC_KEY); this.gh = null; clearInterval(this._timer); this._setStatus('local'); }

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
  exportData() { return JSON.stringify(this.data, null, 2); }
  async importData(json) {
    const d = JSON.parse(json);
    if (!d?.pet?.state || !d.pet.birthDate) throw new Error('El archivo no es una copia válida.');
    this.data = migrate(d);
    if (!this.data.pet.members.some((m) => m.id === this.meId)) this.setMe(this.data.pet.members[0].id);
    this._save();
    if (this.gh) await this._push('Mushu: restaurar copia');
    return this.pet;
  }
}
