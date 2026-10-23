// Modo compartido: Supabase es la fuente de verdad. Cada dispositivo inicia sesión de forma
// anónima (sin correo ni contraseña) y se une a la mascota con el código de invitación.
// Las acciones se validan en el servidor (supabase/schema.sql). Si no hay Internet, las
// acciones quedan pendientes con un identificador único y se envían al volver la conexión:
// el servidor ignora los duplicados, así que nunca se cobran dos veces.

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const PENDING = 'mascota.pending.v1';

const REASONS = {
  moved_out: 'Ya se independizó.',
  daily_limit: 'Ya hizo eso bastante por hoy.',
  food_limit: 'Ya comió eso hoy.',
  cooldown: 'Espera un poco antes de repetir.',
  too_tired: 'Está demasiado cansado para jugar.',
  unknown_action: 'Acción desconocida.',
  unknown_food: 'Ese alimento no existe.',
  invalid_code: 'Ese código no existe. Revisa las letras.',
  pet_full: 'Esta mascota ya tiene sus dos cuidadores. Si eres uno de ellos, escribe tu nombre exactamente igual.',
  not_member: 'No tienes acceso a esta mascota.',
  birth_in_future: 'La fecha de nacimiento no puede ser futura.',
  invalid_settings: 'Los días de evolución deben ir de menor a mayor.',
};
export const reasonText = (r, waitMin) => (r === 'cooldown' && waitMin ? `Espera ${waitMin} min.` : REASONS[r] || 'No se pudo completar.');

function errText(e) {
  const m = e?.message || String(e);
  for (const k in REASONS) if (m.includes(k)) return REASONS[k];
  if (/anonymous/i.test(m)) return 'Activa los inicios de sesión anónimos en Supabase (Authentication → Sign In / Providers → Anonymous).';
  if (/fetch|network|Failed/i.test(m)) return 'Sin conexión con el servidor.';
  return m;
}

export class SupabaseBackend {
  constructor(url, key) {
    this.mode = 'cloud';
    this.url = url; this.key = key;
    this.status = 'connecting';
    this.listeners = new Set();
    this.pet = null;
    this.meId = null;
    this.channel = null;
    window.addEventListener('online', () => this._flush());
  }

  _emit(type, data) { for (const f of this.listeners) f(type, data); }
  _setStatus(s) { if (this.status !== s) { this.status = s; this._emit('status', s); } }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  async _rpc(fn, args) {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) { const e = new Error(errText(error)); e.raw = error; throw e; }
    return data;
  }

  async init() {
    const { createClient } = await import(SUPABASE_JS);
    this.sb = createClient(this.url, this.key, { auth: { persistSession: true, autoRefreshToken: true } });
    let { data: { session } } = await this.sb.auth.getSession();
    if (!session) {
      const { data, error } = await this.sb.auth.signInAnonymously();
      if (error) throw new Error(errText(error));
      session = data.session;
    }
    this.meId = session.user.id;
    const ids = await this._rpc('my_pets', {});
    this._setStatus(navigator.onLine ? 'online' : 'offline');
    if (!ids?.length) return null;
    this.pet = await this._rpc('pet_view', { p_pet: ids[0] });
    this._listen();
    this._rpc('touch', { p_pet: this.pet.id }).catch(() => {});
    this._flush();
    return this.pet;
  }

  _listen() {
    if (this.channel) this.sb.removeChannel(this.channel);
    const id = this.pet.id;
    this.channel = this.sb.channel(`pet-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pets', filter: `id=eq.${id}` }, () => this._refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pet_members', filter: `pet_id=eq.${id}` }, () => this._refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'care_log', filter: `pet_id=eq.${id}` }, (p) => {
        const r = p.new;
        if (r.user_id !== this.meId) this._emit('remote', { name: r.display_name, action: r.action, item: r.item, at: r.created_at });
      })
      .subscribe((st) => { if (st === 'SUBSCRIBED') this._setStatus('online'); else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') this._setStatus('offline'); });
  }

  async _refresh() {
    try {
      const pet = await this._rpc('pet_view', { p_pet: this.pet.id });
      if (!this.pet || pet.version !== this.pet.version || JSON.stringify(pet.members) !== JSON.stringify(this.pet.members)) {
        this.pet = pet; this._emit('pet', pet);
      }
    } catch { this._setStatus('offline'); }
  }

  async createPet({ name, birthDate, myName }) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/La_Paz';
    this.pet = await this._rpc('create_pet', { p_name: name, p_birth: birthDate, p_display: myName, p_tz: tz });
    this._listen();
    return this.pet;
  }

  async joinPet(code, myName) {
    this.pet = await this._rpc('join_pet', { p_code: code, p_display: myName });
    this._listen();
    return this.pet;
  }

  _pending() { try { return JSON.parse(localStorage.getItem(PENDING) || '[]'); } catch { return []; } }
  _savePending(list) { try { localStorage.setItem(PENDING, JSON.stringify(list)); } catch {} }

  async act(action, item) {
    const clientId = crypto.randomUUID();
    try {
      const res = await this._rpc('perform_action', { p_pet: this.pet.id, p_action: action, p_item: item, p_client: clientId });
      this._setStatus('online');
      if (res.pet) this.pet = res.pet;
      return res.ok ? { ok: true, pet: this.pet, log: res.log } : { ok: false, reason: reasonText(res.reason, res.waitMin), pet: this.pet };
    } catch (e) {
      if (!navigator.onLine || /conexión/.test(e.message)) {
        const list = this._pending(); list.push({ action, item, clientId, petId: this.pet.id }); this._savePending(list);
        this._setStatus('offline');
        return { ok: true, pending: true, pet: this.pet };
      }
      return { ok: false, reason: e.message, pet: this.pet };
    }
  }

  get pendingCount() { return this._pending().length; }

  async _flush() {
    const list = this._pending();
    if (!list.length || !this.pet) return;
    const rest = [];
    for (const p of list) {
      try { await this._rpc('perform_action', { p_pet: p.petId, p_action: p.action, p_item: p.item, p_client: p.clientId }); }
      catch (e) { if (/conexión/.test(e.message)) rest.push(p); }
    }
    this._savePending(rest);
    if (rest.length < list.length) await this._refresh();
  }

  async history(limit = 120) {
    const { data, error } = await this.sb.from('care_log').select('display_name, action, item, created_at, user_id')
      .eq('pet_id', this.pet.id).order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(errText(error));
    return data.map((r) => ({ name: r.display_name, action: r.action, item: r.item, at: r.created_at, memberId: r.user_id }));
  }

  async updatePet({ name, birthDate, settings }) {
    this.pet = await this._rpc('update_pet', { p_pet: this.pet.id, p_name: name || null, p_birth: birthDate || null, p_settings: settings || null });
    return this.pet;
  }
  async setMyName(name) { this.pet = await this._rpc('set_my_name', { p_pet: this.pet.id, p_name: name }); return this.pet; }
  async recordEvolution(stage) { this.pet = await this._rpc('record_evolution', { p_pet: this.pet.id, p_stage: stage }); return this.pet; }
  async resetPet(birthDate) { this.pet = await this._rpc('reset_pet', { p_pet: this.pet.id, p_birth: birthDate }); return this.pet; }

  async exportData() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), pet: this.pet, log: await this.history(1000) }, null, 2);
  }
  async forget() { await this.sb?.auth.signOut(); }
}
