// Controlador de la app: pantallas, cuidados, armario, minijuego, sincronización y evolución.

import { PetView } from '../pet/index.js';
import { STAGES, stageById } from '../pet/stages.js';
import { FOODS, foodIcon } from '../pet/food.js';
import { SLOTS, ITEMS, COSTUMES, itemById, itemThumb, isUnlocked } from '../pet/wardrobe.js';
import { ACTIVITY_LABELS } from '../pet/activities.js';
import { derive, canDo, ACTIONS, MILESTONES, localDay, addDays, dayDiff, SLEEP_MIN } from './rules.js';
import { Store, encodeLink, decodeLink, guessRepo } from './store.js';
import { MiniGame } from './minigame.js';
import { boxSVG } from './box.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tzNow = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/La_Paz';

const ICONS = {
  eat: '<path d="M8 4v9a3 3 0 0 0 6 0V4M11 4v20M22 4c-3 0-4 4-4 8s1 5 4 5v7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  pet: '<path d="M14 24s-9-5.6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.4-9 12-9 12Z" fill="currentColor"/>',
  play: '<circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14 4v20M4 14h20M7 7c4 3 10 3 14 0M7 21c4-3 10-3 14 0" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  bath: '<path d="M4 14h20v3a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6Z" fill="currentColor"/><path d="M7 14V7a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="19" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="23" cy="10" r="1.3" fill="currentColor"/>',
  sleep: '<path d="M3 21v-9M3 17h22v4M25 21v-6a3 3 0 0 0-3-3H12v5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="13" r="2.5" fill="currentColor"/><path d="M17 3h5l-5 5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  dance: '<path d="M11 21V6l12-3v15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="8" cy="21" r="3.2" fill="currentColor"/><circle cx="20" cy="18" r="3.2" fill="currentColor"/>',
};
const icon = (k) => `<svg viewBox="0 0 28 28" aria-hidden="true">${ICONS[k]}</svg>`;
const HEART = (on) => `<svg viewBox="0 0 24 24" class="${on ? '' : 'off'}"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11Z" fill="var(--heart)"/><path d="M7.5 8.2c.6-1.2 1.6-1.6 2.4-1.4" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
const FLAME = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 2.5-6 .5 2 1.5 3 2.5 3-1-3 0-6 1-9Z" fill="#ff7a2f"/></svg>';

const store = new Store();
let pet = null, pv = null, welcomePv = null, closetPv = null;
let currentView = 'home';
let evolving = false;
let draft = {}, closetSlot = 'head';
let mainStarted = false;

// ---------------------------------------------------------------- utilidades
function show(id) { for (const s of ['scr-loading', 'scr-welcome', 'scr-who', 'scr-main']) $('#' + s).hidden = s !== id; }
let toastT;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
}
function banner(title, text, ms = 3200) {
  const b = $('#banner'); b.querySelector('h2').textContent = title; b.querySelector('p').textContent = text;
  b.classList.add('on'); setTimeout(() => b.classList.remove('on'), ms);
}
function paint(stage) {
  const p = stage.palette, r = document.documentElement.style;
  r.setProperty('--bg1', p.bg1); r.setProperty('--bg2', p.bg2); r.setProperty('--accent', p.accent); r.setProperty('--ink', p.accentInk);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg1);
}
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

// ---------------------------------------------------------------- arranque
async function boot() {
  try { pet = await store.init(); } catch (e) { pet = store.pet; }
  store.subscribe(onStore);
  if (!pet) return showWelcome();
  if (store.needsIdentity()) return showWho();
  enterMain();
}

// ---------------------------------------------------------------- bienvenida
function showWelcome() {
  show('scr-welcome');
  paint(STAGES[0]);
  if (!welcomePv) { welcomePv = new PetView($('#pet-welcome'), { stage: 1, scene: false }); welcomePv.setMood('happy'); }
  updateBirthHint();
}
function updateBirthHint() {
  const v = $('#in-birth').value;
  if (!v) return;
  const days = dayDiff(v, localDay(new Date(), tzNow()));
  $('#birth-hint').textContent = days < 0 ? 'La fecha no puede ser futura.' : `Hoy tiene ${days} días. Crece a los 600 y a los 900 días.`;
}
$('#in-birth').addEventListener('input', updateBirthHint);
$('#welcome-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#welcome-tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  $('#f-create').hidden = b.dataset.tab !== 'create';
  $('#f-join').hidden = b.dataset.tab !== 'join';
});
$('#f-create').addEventListener('submit', async (e) => {
  e.preventDefault();
  const birthDate = $('#in-birth').value;
  if (dayDiff(birthDate, localDay(new Date(), tzNow())) < 0) { $('#create-err').textContent = 'La fecha no puede ser futura.'; return; }
  pet = await store.createPet({
    name: $('#in-name').value.trim(), birthDate, streak: Math.max(0, +$('#in-streak').value || 0),
    myName: $('#in-me').value.trim(), partnerName: $('#in-partner').value.trim(),
  });
  enterMain(true);
});
$('#f-join').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true; $('#join-err').textContent = '';
  try {
    const cfg = decodeLink($('#in-code').value);
    const remote = await store.peekRemote(cfg);
    if (!remote) throw new Error('Todavía no hay ninguna mascota guardada. Pide a tu pareja que la conecte primero desde Ajustes.');
    await store.connect(cfg, { prefer: 'remote' });
    pet = store.pet;
    showWho();
  } catch (err) { $('#join-err').textContent = err.message; }
  btn.disabled = false;
});

// ---------------------------------------------------------------- ¿quién eres?
function showWho() {
  show('scr-who');
  paint(stageById(derive(pet, new Date(), null).stageId));
  $('#who-title').textContent = `¿Quién eres para ${pet.name}?`;
  $('#who-list').innerHTML = pet.members.map((m) => `<button type="button" class="btn who-btn" data-id="${esc(m.id)}">${esc(m.name)}</button>`).join('');
}
$('#who-list').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  store.setMe(b.dataset.id);
  if (mainStarted) { show('scr-main'); render(); } else enterMain();
});

// ---------------------------------------------------------------- pantalla principal
function enterMain(firstTime = false) {
  show('scr-main');
  welcomePv?.destroy(); welcomePv = null;
  const now = new Date();
  const d = derive(pet, now, store.meId);
  const seenKey = `mascota.seenStage.${pet.id}`;
  const seen = +LS.get(seenKey) || 0;
  const startStage = seen && seen < d.stageId ? seen : d.stageId;
  if (!seen || firstTime) LS.set(seenKey, String(d.stageId));
  pv = new PetView($('#pet'), { stage: startStage, activities: true });
  pv.setOutfit(pet.state.outfit);
  pv.onInteract = onPetTouch;
  paint(stageById(startStage));
  buildDock();
  mainStarted = true;
  render();
  setInterval(render, 20000);
  setInterval(updateCooldowns, 5000);
  if (firstTime) { banner(`¡Hola, ${pet.name}!`, `Tiene ${d.age} días. Cuidadlo cada día entre los dos.`); return; }
  // A veces lo pillas haciendo algo
  if (!d.movedOut && !d.sleepUntil && d.mood !== 'sad' && Math.random() < 0.6) {
    setTimeout(() => { const a = pv.startActivity(); if (a) toast(`Lo pillaste ${ACTIVITY_LABELS[a]}`); }, 500);
  }
}

function onStore(type, data) {
  if (type === 'status') return renderStatus();
  if (!pv) return;
  if (type === 'pet') {
    const prevOutfit = JSON.stringify(pet?.state.outfit || {});
    pet = data;
    if (JSON.stringify(pet.state.outfit || {}) !== prevOutfit) { pv.setOutfit(pet.state.outfit); if (pv.anim.state === 'idle') pv.act('admire'); }
    render();
    if (currentView === 'history') renderHistory();
  }
  if (type === 'remote') {
    toast(`${data.name} ${describe(data.action, data.item)}`);
    const food = FOODS.find((f) => f.id === data.item);
    if (!pv.anim.busy) {
      if (data.action === 'feed' && food) pv.feed(food);
      else if (data.action === 'bath') pv.act('bath');
      else if (data.action === 'play') pv.act('play');
      else if (data.action === 'pet') { pv.act('pet'); setTimeout(() => pv.anim.release('pet'), 2200); }
    }
  }
}

function describe(action, item) {
  const food = FOODS.find((f) => f.id === item);
  return {
    feed: `le dio ${food ? food.name.toLowerCase() : 'de comer'}`, pet: 'lo acarició', play: 'jugó con él',
    bath: 'lo bañó', sleep: 'lo llevó a la cama', reset: 'empezó de nuevo', outfit: 'le cambió la ropa',
    game: `jugó al minijuego (${item} puntos)`,
  }[action] || action;
}

function render() {
  if (!pet || !pv) return;
  const now = new Date();
  const d = derive(pet, now, store.meId);
  const stage = stageById(d.stageId);
  $('#pet-name').textContent = pet.name;
  $('#tab-name').textContent = pet.name;
  document.title = pet.name;
  $('#pet-age').textContent = `${d.age} días`;
  $('#pet-stage').textContent = stage.title;
  $('#lives').innerHTML = [0, 1, 2].map((i) => HEART(i < d.lives)).join('');
  $('#lives').setAttribute('aria-label', `${d.lives} de 3 vidas este mes`);
  $('#lives').title = `${d.lives} de 3 vidas este mes. El día 1 vuelve a tener 3.`;
  $('#streak').innerHTML = `${FLAME}<b>${d.streak}</b><span>racha</span>`;
  $('#streak').title = `Racha: ${d.streak} días cuidándolo. Días juntos: ${pet.state.togetherDays}.`;
  renderStatus();
  renderCarer();

  // mudanza
  $('#moved').hidden = !d.movedOut;
  for (const id of ['#pet', '#dock', '#stats', '#evo', '#hint']) $(id).hidden = d.movedOut;
  if (d.movedOut) {
    $('#tray').hidden = true; $('#bubble').hidden = true;
    $('#box').innerHTML = boxSVG(pet.name);
    $('#moved-title').textContent = `${pet.name} se independizó`;
    const since = pet.state.movedOutAt || d.movedOutDay;
    $('#moved-text').textContent = `Este mes pasó tres días sin que nadie lo cuidara y decidió mudarse. Se fue el ${fmtDate(since)}, con ${Math.max(0, dayDiff(pet.birthDate, since))} días.`;
    pv.stop();
    return;
  }
  if (currentView === 'home') pv.start();

  // evolución pendiente (por ejemplo, ocurrió con la app cerrada)
  const seenKey = `mascota.seenStage.${pet.id}`;
  const seen = +LS.get(seenKey) || d.stageId;
  if (d.stageId > seen && !evolving && !d.sleepUntil) runEvolution(seen, d.stageId);
  else if (!evolving && pv.stage.id !== d.stageId) { pv.setStage(d.stageId); paint(stage); }

  // dormir en la cama durante su descanso
  if (d.sleepUntil && !pv.anim.inBed && !evolving) pv.sleepInBed(!pv.anim.isSleeping && pv.anim.state !== 'goToBed' ? true : false);
  if (!d.sleepUntil && pv.anim.inBed) { pv.wakeFromBed(); toast(`${pet.name} se despertó descansado`); }

  const n = d.next;
  $('#evo').textContent = !n ? 'Ha alcanzado su última etapa.'
    : n.daysLeft > 0 ? `Crece el día ${n.day} · faltan ${n.daysLeft} días (${fmtDate(n.date)})`
    : `Le faltan ${n.needCare} días de cuidados para crecer`;

  if (!evolving) pv.setMood(d.mood);
  const msg = d.sleepUntil ? `Durmiendo en su cama hasta las ${fmtTime(d.sleepUntil)}` : d.message;
  $('#bubble').hidden = !msg;
  $('#bubble').textContent = msg || '';

  const labels = { hunger: 'Saciedad', happiness: 'Felicidad', energy: 'Energía', hygiene: 'Higiene' };
  $('#stats').innerHTML = Object.entries(labels).map(([k, l]) => {
    const v = Math.round(d.stats[k]);
    return `<div class="stat"><span>${l}</span><div class="bar" role="meter" aria-label="${l}" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i class="${v < 30 ? 'low' : v < 55 ? 'mid' : ''}" style="width:${v}%"></i></div></div>`;
  }).join('');
  updateCooldowns();
}

function renderStatus() {
  const s = $('#status'); if (!s) return;
  const st = store.status;
  s.dataset.s = st;
  const pend = store.pendingCount;
  s.textContent = st === 'local' ? 'Solo en este teléfono'
    : st === 'online' ? 'Compartido con tu pareja'
    : st === 'syncing' ? 'Guardando…'
    : `Sin conexión${pend ? ` · ${pend} pendiente${pend > 1 ? 's' : ''}` : ''}`;
}

function renderCarer() {
  const c = $('#carer');
  const me = pet.members.find((m) => m.id === store.meId);
  c.hidden = !me;
  if (!me) return;
  c.disabled = store.synced;
  c.textContent = store.synced ? `Eres ${me.name}` : `Cuida ahora: ${me.name} ⇄`;
}
$('#carer').addEventListener('click', () => {
  if (store.synced) return;
  const other = pet.members.find((m) => m.id !== store.meId);
  store.setMe(other.id); render(); toast(`Ahora cuida ${other.name}`);
});

async function runEvolution(from, to) {
  evolving = true;
  pv.setStage(from); paint(stageById(from));
  for (let s = from + 1; s <= to; s++) {
    setTimeout(() => paint(stageById(s)), 2300);
    await pv.evolveTo(s);
    banner(`¡${pet.name} creció!`, `${stageById(s).title}: ${stageById(s).subtitle.toLowerCase()}`, 4000);
    LS.set(`mascota.seenStage.${pet.id}`, String(s));
    const r = await store.recordEvolution(s); if (r.pet) pet = r.pet;
  }
  evolving = false;
  render();
}

// ---------------------------------------------------------------- acciones
const DOCK = [
  { id: 'feed', label: 'Comer', icon: 'eat', primary: true },
  { id: 'pet', label: 'Acariciar', icon: 'pet' },
  { id: 'play', label: 'Jugar', icon: 'play' },
  { id: 'bath', label: 'Bañar', icon: 'bath' },
  { id: 'sleep', label: 'Dormir', icon: 'sleep' },
  { id: 'dance', label: 'Bailar', icon: 'dance' },
];
function buildDock() {
  $('#dock').innerHTML = DOCK.map((a) => `<button type="button" class="act${a.primary ? ' primary' : ''}" data-act="${a.id}">${icon(a.icon)}<span class="lbl">${a.label}</span><span class="wait"></span></button>`).join('');
  $('#tray').innerHTML = FOODS.map((f) => `<button type="button" class="food" data-food="${f.id}" title="${esc(f.name)}">${foodIcon(f, 40)}<span>${esc(f.name.split(' ')[0])}</span><small>${esc(f.category)}</small></button>`).join('');
}

function updateCooldowns() {
  if (!pet || !pv) return;
  const now = new Date();
  const d = derive(pet, now, store.meId);
  for (const b of document.querySelectorAll('#dock .act')) {
    const id = b.dataset.act, w = b.querySelector('.wait');
    if (d.sleepUntil) { b.classList.toggle('cool', id !== 'pet'); w.textContent = id === 'sleep' ? `hasta ${fmtTime(d.sleepUntil)}` : ''; continue; }
    if (!ACTIONS[id] || id === 'feed') { w.textContent = ''; b.classList.remove('cool'); continue; }
    const c = canDo(pet, id, null, now);
    b.classList.toggle('cool', !c.ok && id !== 'play');
    w.textContent = c.waitMin ? `${c.waitMin} min` : (!c.ok && id !== 'play' ? 'hoy no' : '');
  }
  for (const f of document.querySelectorAll('#tray .food')) f.classList.toggle('cool', !canDo(pet, 'feed', f.dataset.food, now).ok);
}

const ANIM_REASON = { sleeping: 'Está durmiendo. Déjalo descansar.', busy: 'Espera a que termine.' };

async function perform(action, item) {
  const now = new Date();
  const chk = canDo(pet, action, item, now);
  if (!chk.ok) { if (chk.sleeping) pv.act('poke'); toast(chk.reason); return; }
  let r;
  if (action === 'feed') r = pv.feed(FOODS.find((f) => f.id === item));
  else if (action === 'pet') { r = pv.act('pet'); if (r.ok && !r.sleeping) setTimeout(() => pv.anim.release('pet'), 2400); }
  else if (action === 'sleep') r = pv.sleepInBed();
  else r = pv.act(action);
  if (!r.ok) { toast(ANIM_REASON[r.reason] || 'Ahora no puede.'); return; }
  const res = await store.act(action, item);
  if (res.pet) pet = res.pet;
  if (!res.ok) { toast(res.reason); if (action === 'sleep') pv.wakeFromBed(); }
  else if (action === 'sleep') toast(`A dormir: descansará ${SLEEP_MIN / 60} horas`);
  else if (res.pending) toast('Sin conexión: se guardará al volver Internet.');
  checkMilestones();
  render();
}

$('#dock').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.dataset.act;
  if (id === 'feed') { $('#tray').hidden = !$('#tray').hidden; return; }
  $('#tray').hidden = true;
  if (id === 'dance') { const r = pv.act('dance'); if (!r.ok) toast(ANIM_REASON[r.reason] || 'Ahora no puede.'); return; }
  if (id === 'play') return openGame();
  perform(id);
});
$('#tray').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $('#tray').hidden = true;
  perform('feed', b.dataset.food);
});

// Minijuego: jugar cuenta como cuidado (con su tiempo de espera); si no toca, se puede jugar igual.
function openGame() {
  const now = new Date();
  const d = derive(pet, now, store.meId);
  if (d.sleepUntil) { toast(ANIM_REASON.sleeping); return; }
  const chk = canDo(pet, 'play', null, now);
  pv.stop();
  new MiniGame({
    stage: d.stageId, outfit: pet.state.outfit, name: pet.name,
    rewardNote: chk.ok ? '' : `${chk.reason} Puedes jugar, pero esta partida no contará como cuidado.`,
    onEnd: async (score) => {
      pv.start();
      if (score == null) return;
      if (chk.ok) {
        const res = await store.act('play');
        if (res.pet) pet = res.pet;
        if (!res.ok) toast(res.reason);
      }
      await store.logGame(score);
      pv.act(score >= 15 ? 'celebrate' : 'hop');
      checkMilestones();
      render();
    },
  });
}

// Acariciar con el dedo cuenta como cuidado (con su tiempo de espera); tocar solo es una reacción.
function onPetTouch(kind, r) {
  if (kind === 'ball') return;
  if (!r.ok) { toast(r.reason === 'sleeping' ? 'Shh… está durmiendo' : (ANIM_REASON[r.reason] || 'Ahora no puede.')); return; }
  if (r.woke) toast('¡Lo despertaste!');
  if (kind === 'pet' && canDo(pet, 'pet', null, new Date()).ok) {
    store.act('pet', null).then((res) => { if (res.pet) pet = res.pet; render(); });
  }
}

function checkMilestones() {
  const together = pet.state.togetherDays || 0;
  const key = `mascota.milestone.${pet.id}`;
  const got = +LS.get(key) || 0;
  const m = MILESTONES.filter((x) => x <= together).pop();
  if (m && m > got) {
    LS.set(key, String(m));
    pv.act('celebrate');
    banner(`¡${m} días cuidando juntos a ${pet.name}!`, 'Logro de la pareja conseguido.');
  }
}

// ---------------------------------------------------------------- mudanza
$('#btn-restart').addEventListener('click', () => { $('#restart-confirm').hidden = false; });
$('#btn-restart-no').addEventListener('click', () => { $('#restart-confirm').hidden = true; });
$('#btn-restart-yes').addEventListener('click', async () => {
  const r = await store.resetPet(localDay(new Date(), pet.tz), 0);
  pet = r.pet;
  LS.set(`mascota.seenStage.${pet.id}`, '1');
  $('#restart-confirm').hidden = true;
  pv.setStage(1); paint(STAGES[0]);
  render();
  banner(`${pet.name} ha vuelto`, 'Empieza de nuevo. Cuidadlo cada día.');
});

// ---------------------------------------------------------------- navegación
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  currentView = b.dataset.view;
  document.querySelectorAll('.tabbar button').forEach((x) => (x === b ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current')));
  for (const v of ['home', 'closet', 'history', 'settings']) $('#view-' + v).hidden = v !== currentView;
  if (currentView === 'home') pv.start(); else pv.stop();
  if (currentView === 'closet') openCloset(); else closetPv?.stop();
  if (currentView === 'history') renderHistory();
  if (currentView === 'settings') renderSettings();
  window.scrollTo(0, 0);
});

// ---------------------------------------------------------------- armario
function openCloset() {
  draft = { ...(pet.state.outfit || {}) };
  const d = derive(pet, new Date(), store.meId);
  if (!closetPv) { closetPv = new PetView($('#pet-closet'), { stage: d.stageId, scene: false, viewBox: '-20 -70 330 360' }); closetPv.setMood('happy'); }
  else { closetPv.setStage(d.stageId); closetPv.start(); }
  closetPv.setOutfit(draft);
  renderCloset();
}
function renderCloset() {
  const care = pet.state.careDaysTotal;
  $('#slots').innerHTML = SLOTS.map((s) => `<button type="button" role="tab" aria-selected="${s.id === closetSlot}" data-slot="${s.id}">${s.label}${draft[s.id] ? ' •' : ''}</button>`).join('');
  $('#items').innerHTML = ITEMS.filter((i) => i.slot === closetSlot).map((i) => {
    const open = isUnlocked(i, care);
    return `<button type="button" class="item${draft[i.slot] === i.id ? ' on' : ''}${open ? '' : ' locked'}" data-item="${i.id}" aria-pressed="${draft[i.slot] === i.id}">
      ${itemThumb(i, 58)}<span>${esc(i.name)}</span>${open ? '' : `<small>${i.unlock.careDays} días de cuidados</small>`}</button>`;
  }).join('');
  $('#costumes').innerHTML = COSTUMES.map((c) => `<button type="button" class="costume" data-costume="${c.id}">${esc(c.name)}</button>`).join('');
}
$('#slots').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; closetSlot = b.dataset.slot; renderCloset(); });
$('#items').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const it = itemById(b.dataset.item);
  if (!isUnlocked(it, pet.state.careDaysTotal)) { toast(`Se desbloquea con ${it.unlock.careDays} días de cuidados (lleváis ${pet.state.careDaysTotal}).`); return; }
  if (draft[it.slot] === it.id) delete draft[it.slot]; else draft[it.slot] = it.id;
  closetPv.setOutfit(draft);
  if (draft[it.slot]) closetPv.act('admire');
  renderCloset();
});
$('#costumes').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const c = COSTUMES.find((x) => x.id === b.dataset.costume);
  const locked = Object.values(c.outfit).map(itemById).find((i) => !isUnlocked(i, pet.state.careDaysTotal));
  if (locked) { toast(`Para este disfraz falta desbloquear: ${locked.name}.`); return; }
  draft = { ...c.outfit };
  closetPv.setOutfit(draft); closetPv.act('celebrate');
  renderCloset();
});
$('#btn-undress').addEventListener('click', () => { draft = {}; closetPv.setOutfit(draft); renderCloset(); });
$('#btn-wear').addEventListener('click', async () => {
  const r = await store.setOutfit({ ...draft });
  if (r.pet) pet = r.pet;
  pv.setOutfit(pet.state.outfit);
  document.querySelector('.tabbar [data-view="home"]').click();
  setTimeout(() => { if (!pv.anim.isSleeping) pv.act('admire'); }, 200);
  toast(Object.keys(draft).length ? '¡Le encanta su ropa nueva!' : 'Sin ropa, al natural');
});

// ---------------------------------------------------------------- historial
function renderHistory() {
  const d = derive(pet, new Date(), store.meId);
  const today = d.today, yesterday = addDays(today, -1);
  const seen = (m) => {
    if (!m.lastCareAt) return 'aún no lo ha cuidado';
    const day = localDay(new Date(m.lastCareAt), pet.tz);
    return `${day === today ? 'hoy' : day === yesterday ? 'ayer' : fmtDate(day)} ${fmtTime(m.lastCareAt)}`;
  };
  $('#summary').innerHTML = `
    <div class="card"><b>${d.age}</b><span>días de edad</span></div>
    <div class="card"><b>${d.streak}</b><span>racha</span></div>
    <div class="card"><b>${pet.state.togetherDays}</b><span>días juntos</span></div>
    <div class="card members">${pet.members.map((m) => `<div><span>${esc(m.name)}</span><small>Último cuidado: ${esc(seen(m))}</small></div>`).join('')}
      <div><span>Vidas este mes</span><small>${d.lives} de 3 · el día 1 vuelve a tener 3</small></div></div>`;
  $('#badges').innerHTML = MILESTONES.map((m) => `<span class="badge${pet.state.togetherDays >= m ? ' on' : ''}">${m} días juntos</span>`).join('')
    + (pet.state.evolutions || []).map((e) => `<span class="badge on">${esc(stageById(e.stage).title)} · ${fmtDate(localDay(new Date(e.at), pet.tz))}</span>`).join('');
  const logs = store.history();
  if (!logs.length) { $('#log').innerHTML = '<li class="empty">Todavía no hay cuidados. ¡Dale de comer!</li>'; return; }
  let html = '', lastDay = '';
  for (const l of logs.slice(0, 150)) {
    const day = localDay(new Date(l.at), pet.tz);
    if (day !== lastDay) { html += `<li class="day">${day === today ? 'Hoy' : day === yesterday ? 'Ayer' : fmtDate(day)}</li>`; lastDay = day; }
    html += `<li class="item"><span>${esc(l.name)} ${esc(describe(l.action, l.item))}</span><time>${fmtTime(l.at)}</time></li>`;
  }
  $('#log').innerHTML = html;
}

// ---------------------------------------------------------------- ajustes
function renderSettings() {
  const synced = store.synced;
  $('#share-off').hidden = synced;
  $('#share-on').hidden = !synced;
  if (synced) {
    const c = store.syncConfig;
    const me = pet.members.find((m) => m.id === store.meId);
    $('#share-info').textContent = `Conectado a ${c.owner}/${c.repo}. Eres ${me?.name || '?'}.`;
    $('#link-code').value = encodeLink(c);
  } else {
    const g = guessRepo();
    if (!$('#sh-owner').value) $('#sh-owner').value = g.owner;
    if (!$('#sh-repo').value) $('#sh-repo').value = g.repo;
  }
  $('#set-name').value = pet.name;
  $('#names-fields').innerHTML = pet.members.map((m, i) => `<label for="set-m${i}">Cuidador ${i + 1}${m.id === store.meId ? ' (tú)' : ''}</label><input id="set-m${i}" data-id="${esc(m.id)}" maxlength="24" required value="${esc(m.name)}">`).join('');
  $('#set-birth').value = pet.birthDate;
  $('#set-streak').value = pet.state.streak;
  $('#set-d2').value = pet.settings.stageDays[1];
  $('#set-d3').value = pet.settings.stageDays[2];
  $('#time-fields').hidden = true; $('#time-fields').disabled = true; $('#btn-unlock').hidden = false;
}
$('#f-share').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (store.synced) return;
  const cfg = { owner: $('#sh-owner').value.trim(), repo: $('#sh-repo').value.trim(), token: $('#sh-token').value.trim() };
  $('#share-err').textContent = '';
  if (!cfg.owner || !cfg.repo || !cfg.token) { $('#share-err').textContent = 'Rellena el usuario, el repositorio y el token.'; return; }
  const btn = $('#btn-share'); btn.disabled = true; btn.textContent = 'Conectando…';
  try {
    const remote = await store.peekRemote(cfg);
    // Si ya hay una mascota guardada distinta, se mantiene la de GitHub (la de tu pareja)
    const prefer = remote && remote.id !== pet.id ? 'remote' : 'local';
    const res = await store.connect(cfg, { prefer });
    pet = store.pet;
    if (res === 'adopted' && store.needsIdentity()) { showWho(); return; }
    pv.setOutfit(pet.state.outfit);
    render(); renderSettings();
    toast(res === 'adopted' ? 'Conectado: se cargó la mascota guardada en GitHub.' : '¡Conectado! Ahora pásale el código a tu pareja.');
  } catch (err) { $('#share-err').textContent = err.message; }
  btn.disabled = false; btn.textContent = 'Conectar';
});
$('#btn-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#link-code').value); toast('Código copiado'); }
  catch { $('#link-code').select(); toast('Selecciona y copia el código'); }
});
$('#btn-who').addEventListener('click', () => showWho());
$('#btn-unshare').addEventListener('click', () => { store.disconnect(); renderSettings(); render(); toast('Este teléfono ya no comparte. Los datos siguen aquí.'); });
$('#f-petname').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await store.updatePet({ name: $('#set-name').value.trim() }); pet = r.pet; render(); toast('Nombre guardado');
});
$('#f-names').addEventListener('submit', async (e) => {
  e.preventDefault();
  for (const inp of document.querySelectorAll('#names-fields input')) { const r = await store.setMemberName(inp.dataset.id, inp.value.trim()); pet = r.pet; }
  render(); toast('Nombres guardados');
});
$('#btn-unlock').addEventListener('click', () => { $('#time-fields').hidden = false; $('#time-fields').disabled = false; $('#btn-unlock').hidden = true; });
$('#f-time').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d2 = +$('#set-d2').value, d3 = +$('#set-d3').value;
  if (!(d2 > 0 && d3 > d2)) { $('#time-err').textContent = 'La tercera etapa debe ser posterior a la segunda.'; return; }
  if (dayDiff($('#set-birth').value, localDay(new Date(), tzNow())) < 0) { $('#time-err').textContent = 'La fecha no puede ser futura.'; return; }
  const r = await store.updatePet({ birthDate: $('#set-birth').value, streak: +$('#set-streak').value, settings: { stageDays: [0, d2, d3], minCareDays: pet.settings.minCareDays } });
  pet = r.pet; $('#time-err').textContent = '';
  renderSettings(); render(); toast('Cambios guardados');
});
$('#btn-export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([store.exportData()], { type: 'application/json' }));
  a.download = `${pet.name.toLowerCase()}-copia-${localDay(new Date(), pet.tz)}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('#in-import').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { pet = await store.importData(await f.text()); pv.setOutfit(pet.state.outfit); render(); renderSettings(); toast('Copia restaurada'); }
  catch (err) { toast(err.message); }
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

boot();
