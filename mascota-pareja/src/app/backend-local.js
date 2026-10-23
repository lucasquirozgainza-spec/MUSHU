// Modo local: todo se guarda en este navegador. Sirve para probar la app sin Supabase.
// La interfaz lo indica siempre con claridad: aquí NADA se comparte con la pareja.

import { newPetState, applyAction, neglect, addDays, DEFAULT_SETTINGS, stageFor, ageInDays } from './rules.js';

const KEY = 'mascota.local.v1';

export class LocalBackend {
  constructor() {
    this.mode = 'local';
    this.status = 'local';
    this.listeners = new Set();
    this.data = null;
    this.meId = null;
  }

  _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  }
  _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* almacenamiento lleno o bloqueado */ }
  }

  async init() {
    this.data = this._load();
    if (!this.data) return null;
    this._migrate();
    this.meId = this.data.meId || this.data.pet.members[0].id;
    this._checkMovedOut();
    return this.data.pet;
  }

  _migrate() {
    // espacio para migraciones de esquema local futuras (data.v)
    this.data.v = this.data.v || 1;
    this.data.pet.settings = this.data.pet.settings || structuredClone(DEFAULT_SETTINGS);
  }

  _checkMovedOut() {
    const pet = this.data.pet;
    const n = neglect(pet, new Date());
    if (n.movedOut && !pet.state.movedOutAt) {
      pet.state.movedOutAt = addDays(pet.state.lastCareDay || pet.state.createdDay, 3);
      this._save();
    }
  }

  get pet() { return this.data?.pet || null; }

  async createPet({ name, birthDate, myName, partnerName }) {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/La_Paz';
    const a = { id: 'local-a', name: myName }, b = { id: 'local-b', name: partnerName || 'Pareja' };
    this.data = {
      v: 1, meId: a.id, log: [],
      pet: { id: 'local', name, birthDate, tz, inviteCode: null, settings: structuredClone(DEFAULT_SETTINGS), state: newPetState(now, tz), members: [a, b], version: 1 },
    };
    this.meId = a.id;
    this._save();
    return this.data.pet;
  }

  // En modo local los dos comparten este dispositivo: se elige quién está cuidando.
  setActiveMember(id) { this.meId = id; this.data.meId = id; this._save(); }

  async act(action, item) {
    try {
      const { pet, log } = applyAction(this.data.pet, { action, item, memberId: this.meId }, new Date());
      this.data.pet = pet;
      this.data.log.unshift(log);
      this.data.log = this.data.log.slice(0, 300);
      this._save();
      return { ok: true, pet, log };
    } catch (e) {
      if (e.rule) { this._checkMovedOut(); return { ok: false, reason: e.message, pet: this.data.pet }; }
      throw e;
    }
  }

  async history() { return this.data.log; }

  async updatePet({ name, birthDate, settings }) {
    const p = this.data.pet;
    if (name) p.name = name;
    if (birthDate) p.birthDate = birthDate;
    if (settings) p.settings = settings;
    this._save();
    return p;
  }

  async setMyName(name) {
    const m = this.data.pet.members.find((x) => x.id === this.meId);
    if (m) m.name = name;
    this._save();
    return this.data.pet;
  }

  async setMemberName(id, name) {
    const m = this.data.pet.members.find((x) => x.id === id);
    if (m) m.name = name;
    this._save();
    return this.data.pet;
  }

  async recordEvolution(stage) {
    const p = this.data.pet;
    const now = new Date();
    if (stageFor(ageInDays(p, now), p.state.careDaysTotal, p.settings) >= stage && !p.state.evolutions.some((e) => e.stage === stage)) {
      p.state.evolutions.push({ stage, at: now.toISOString() });
      this._save();
    }
    return p;
  }

  async resetPet(birthDate) {
    const p = this.data.pet;
    const now = new Date();
    p.birthDate = birthDate;
    p.state = newPetState(now, p.tz);
    this.data.log.unshift({ id: String(Date.now()), memberId: this.meId, name: p.members.find((m) => m.id === this.meId)?.name, action: 'reset', at: now.toISOString() });
    this._save();
    return p;
  }

  exportData() { return JSON.stringify(this.data, null, 2); }
  async importData(json) {
    const d = JSON.parse(json);
    if (!d?.pet?.state || !d.pet.birthDate) throw new Error('El archivo no es una copia válida.');
    this.data = d; this._migrate(); this.meId = d.meId || d.pet.members[0].id; this._save();
    return this.data.pet;
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  async forget() { try { localStorage.removeItem(KEY); } catch {} this.data = null; }
}
