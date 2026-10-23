// Controlador de la app: pantallas, acciones de cuidado, sincronización y evolución.

import { PetView } from '../pet/index.js';
import { STAGES, stageById } from '../pet/stages.js';
import { FOODS, foodIcon } from '../pet/food.js';
import { derive, canDo, ACTIONS, MILESTONES, localDay, addDays, dayDiff } from './rules.js';
import { LocalBackend } from './backend-local.js';
import { SupabaseBackend } from './backend-supabase.js';
import { boxSVG } from './box.js';
import { CONFIG } from '../../config.js';

const $ = (s) => document.querySelector(s);
const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICONS = {
  eat: '<path d="M8 4v9a3 3 0 0 0 6 0V4M11 4v20M22 4c-3 0-4 4-4 8s1 5 4 5v7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  pet: '<path d="M14 24s-9-5.6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.4-9 12-9 12Z" fill="currentColor"/>',
  play: '<circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4.5 11c5 2 14 2 19 0M5 18c5-2 13-2 18 0" fill="none" stroke="currentColor" stroke-width="2"/>',
  bath: '<path d="M4 14h20v3a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6Z" fill="currentColor"/><path d="M7 14V7a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="19" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="23" cy="10" r="1.3" fill="currentColor"/>',
  sleep: '<path d="M22 18.5A10 10 0 0 1 11.5 6a9 9 0 1 0 10.5 12.5Z" fill="currentColor" opacity=".9"/><path d="M19 4h5l-5 5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  sun: '<circle cx="14" cy="14" r="5.5" fill="currentColor"/><path d="M14 2.5v3M14 22.5v3M2.5 14h3M22.5 14h3M5.9 5.9l2.1 2.1M20 20l2.1 2.1M5.9 22.1 8 20M20 8l2.1-2.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  dance: '<path d="M11 21V6l12-3v15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="8" cy="21" r="3.2" fill="currentColor"/><circle cx="20" cy="18" r="3.2" fill="currentColor"/>',
};
const icon = (k) => `<svg viewBox="0 0 28 28" aria-hidden="true">${ICONS[k]}</svg>`;
const HEART = (on) => `<svg viewBox="0 0 24 24" class="${on ? '' : 'off'}"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11Z" fill="var(--heart)"/><path d="M7.5 8.2c.6-1.2 1.6-1.6 2.4-1.4" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;

let backend = null, pet = null, pv = null, welcomePv = null;
let currentView = 'home';
let evolving = false;

// ---------------------------------------------------------------- utilidades de UI
function show(id) {
  for (const s of ['scr-loading', 'scr-connect', 'scr-welcome', 'scr-main']) $('#' + s).hidden = s !== id;
}
let toastT;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
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
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

// ---------------------------------------------------------------- arranque
async function boot() {
  const url = CONFIG.SUPABASE_URL || LS.get('mascota.sb.url');
  const key = CONFIG.SUPABASE_ANON_KEY || LS.get('mascota.sb.key');
  let mode = LS.get('mascota.mode');
  if (window.__MASCOTA_DEMO__) mode = 'local';
  if (mode === 'choose') return showConnect();
  if (url && key && mode !== 'local') backend = new SupabaseBackend(url, key);
  else if (mode === 'local') backend = new LocalBackend();
  else return showConnect();
  try {
    pet = await backend.init();
  } catch (e) {
    return showConnect(e.message);
  }
  if (!pet) return showWelcome();
  enterMain();
}

function showConnect(err = '') {
  show('scr-connect');
  $('#connect-err').textContent = err;
  $('#in-url').value = LS.get('mascota.sb.url') || '';
  $('#in-key').value = LS.get('mascota.sb.key') || '';
}
$('#f-connect').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('#in-url').value.trim().replace(/\/$/, ''), key = $('#in-key').value.trim();
  LS.set('mascota.sb.url', url); LS.set('mascota.sb.key', key); LS.set('mascota.mode', 'cloud');
  $('#connect-err').textContent = '';
  show('scr-loading');
  boot();
});
$('#btn-local').addEventListener('click', () => { LS.set('mascota.mode', 'local'); show('scr-loading'); boot(); });

// ---------------------------------------------------------------- bienvenida
function showWelcome() {
  show('scr-welcome');
  paint(STAGES[0]);
  if (!welcomePv) { welcomePv = new PetView($('#pet-welcome'), { stage: 1 }); welcomePv.setMood('happy'); }
  const local = backend.mode === 'local';
  $('#welcome-tabs').hidden = local;
  $('#partner-field').hidden = !local;
  $('#in-partner').required = local;
  updateBirthHint();
}
function updateBirthHint() {
  const v = $('#in-birth').value;
  if (!v) return;
  const days = dayDiff(v, localDay(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone));
  $('#birth-hint').textContent = days < 0 ? 'La fecha no puede ser futura.' : `Hoy tiene ${days} días. Evoluciona a los 600 y a los 900 días.`;
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
  const name = $('#in-name').value.trim(), birthDate = $('#in-birth').value, myName = $('#in-me').value.trim(), partnerName = $('#in-partner').value.trim();
  if (dayDiff(birthDate, localDay(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)) < 0) { $('#create-err').textContent = 'La fecha no puede ser futura.'; return; }
  try {
    pet = await backend.createPet({ name, birthDate, myName, partnerName });
    enterMain(true);
  } catch (err) { $('#create-err').textContent = err.message; }
});
$('#f-join').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    pet = await backend.joinPet($('#in-code').value.trim(), $('#in-me2').value.trim());
    enterMain(true);
  } catch (err) { $('#join-err').textContent = err.message; }
});

// ---------------------------------------------------------------- pantalla principal
function enterMain(firstTime = false) {
  show('scr-main');
  welcomePv?.destroy(); welcomePv = null;
  const d = derive(pet, new Date(), backend.meId);
  const seenKey = `mascota.seenStage.${pet.id}`;
  const seen = +LS.get(seenKey) || 0;
  const startStage = seen && seen < d.stageId ? seen : d.stageId;
  if (!seen || firstTime) LS.set(seenKey, String(d.stageId));
  if (!pv) {
    pv = new PetView($('#pet'), { stage: startStage });
    pv.onInteract = onPetTouch;
    pv.anim.on('mood', () => {});
  } else pv.setStage(startStage);
  paint(stageById(startStage));
  buildDock();
  backend.subscribe(onBackend);
  render();
  setInterval(render, 30000);
  setInterval(updateCooldowns, 5000);
  if (firstTime) banner(`¡Hola, ${pet.name}!`, `Tiene ${d.age} días. Cuidadlo cada día entre los dos.`);
}

function onBackend(type, data) {
  if (type === 'pet') { pet = data; render(); }
  if (type === 'status') renderStatus();
  if (type === 'remote') {
    const food = FOODS.find((f) => f.id === data.item);
    toast(`${data.name} ${describe(data.action, data.item)}`);
    if (pv.anim.state === 'idle') {
      if (data.action === 'feed' && food) pv.feed(food);
      else if (data.action === 'play') pv.act('play');
      else if (data.action === 'bath') pv.act('bath');
      else if (data.action === 'pet') { pv.act('pet'); setTimeout(() => pv.anim.release('pet'), 2200); }
    }
    if (currentView === 'history') renderHistory();
  }
}

function describe(action, item) {
  const food = FOODS.find((f) => f.id === item);
  return {
    feed: `le dio ${food ? food.name.toLowerCase() : 'de comer'}`, pet: 'lo acarició', play: 'jugó con él',
    bath: 'lo bañó', sleep: 'lo llevó a dormir', reset: 'empezó de nuevo',
  }[action] || action;
}

function render() {
  if (!pet) return;
  const now = new Date();
  const d = derive(pet, now, backend.meId);
  const stage = stageById(d.stageId);
  $('#pet-name').textContent = pet.name;
  $('#tab-name').textContent = pet.name;
  document.title = pet.name;
  $('#pet-age').textContent = `${d.age} días`;
  $('#pet-stage').textContent = stage.title;
  $('#lives').innerHTML = [0, 1, 2].map((i) => HEART(i < d.lives)).join('');
  $('#lives').setAttribute('aria-label', `${d.lives} de 3 vidas`);
  $('#streak').innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 2.5-6 .5 2 1.5 3 2.5 3-1-3 0-6 1-9Z" fill="#ff7a2f"/></svg>${d.streak}`;
  $('#streak').title = `Racha compartida: ${d.streak} días seguidos cuidándolo los dos (récord ${pet.state.bestStreak})`;
  renderStatus();
  renderCarer();

  // mudanza
  $('#moved').hidden = !d.movedOut;
  $('#pet').hidden = d.movedOut;
  $('#dock').hidden = d.movedOut; $('#stats').hidden = d.movedOut; $('#evo').hidden = d.movedOut;
  document.querySelector('.hint').hidden = d.movedOut;
  if (d.movedOut) {
    $('#tray').hidden = true; $('#bubble').hidden = true;
    $('#box').innerHTML = boxSVG(pet.name);
    $('#moved-title').textContent = `${pet.name} se independizó`;
    const since = pet.state.movedOutAt || addDays(pet.state.lastCareDay || pet.state.createdDay, 3);
    $('#moved-text').textContent = `Pasaron tres días sin que nadie lo cuidara y decidió mudarse. Se fue el ${fmtDate(since)}, con ${Math.max(0, dayDiff(pet.birthDate, since))} días.`;
    pv.stop();
    return;
  }
  pv.start();

  // evolución pendiente (por ejemplo, ocurrió con la app cerrada)
  const seenKey = `mascota.seenStage.${pet.id}`;
  const seen = +LS.get(seenKey) || d.stageId;
  if (d.stageId > seen && !evolving) runEvolution(seen, d.stageId);
  else if (!evolving && pv.stage.id !== d.stageId) { pv.setStage(d.stageId); paint(stage); }

  // texto de evolución
  const n = d.next;
  $('#evo').textContent = !n ? 'Ha alcanzado su última etapa.'
    : n.daysLeft > 0 ? `Evoluciona el día ${n.day} · faltan ${n.daysLeft} días (${fmtDate(n.date)})`
    : `Le faltan ${n.needCare} días de cuidados para evolucionar`;

  // ánimo
  if (!evolving) pv.setMood(d.mood);
  const bubble = $('#bubble');
  bubble.hidden = !d.message;
  bubble.textContent = d.message || '';

  // estadísticas
  const labels = { hunger: 'Saciedad', happiness: 'Felicidad', energy: 'Energía', hygiene: 'Higiene' };
  $('#stats').innerHTML = Object.entries(labels).map(([k, l]) => {
    const v = Math.round(d.stats[k]);
    return `<div class="stat"><span>${l}</span><div class="bar" role="meter" aria-label="${l}" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i class="${v < 30 ? 'low' : v < 55 ? 'mid' : ''}" style="width:${v}%"></i></div></div>`;
  }).join('');
  updateCooldowns();
}

function renderStatus() {
  const s = $('#status');
  const st = backend.status;
  s.dataset.s = st;
  const pend = backend.pendingCount || 0;
  s.textContent = st === 'local' ? 'Modo local · no se comparte'
    : st === 'online' ? 'Compartido · en línea'
    : st === 'offline' ? `Sin conexión${pend ? ` · ${pend} pendiente${pend > 1 ? 's' : ''}` : ''}` : 'Conectando…';
}

function renderCarer() {
  const c = $('#carer');
  if (backend.mode !== 'local') {
    const me = pet.members.find((m) => m.id === backend.meId);
    c.hidden = !me; c.disabled = true;
    if (me) c.textContent = `Eres ${me.name}`;
    return;
  }
  c.hidden = false; c.disabled = false;
  const me = pet.members.find((m) => m.id === backend.meId);
  c.textContent = `Cuida ahora: ${me?.name || '?'} ⇄`;
}
$('#carer').addEventListener('click', () => {
  if (backend.mode !== 'local') return;
  const other = pet.members.find((m) => m.id !== backend.meId);
  backend.setActiveMember(other.id);
  render();
  toast(`Ahora cuida ${other.name}`);
});

async function runEvolution(from, to) {
  evolving = true;
  pv.setStage(from); paint(stageById(from));
  for (let s = from + 1; s <= to; s++) {
    setTimeout(() => paint(stageById(s)), 2300);
    await pv.evolveTo(s);
    banner(`¡${pet.name} evolucionó!`, `${stageById(s).title}: ${stageById(s).subtitle.toLowerCase()}`, 4000);
    LS.set(`mascota.seenStage.${pet.id}`, String(s));
    try { pet = await backend.recordEvolution(s); } catch {}
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
  for (const b of document.querySelectorAll('#dock .act')) {
    const id = b.dataset.act;
    const w = b.querySelector('.wait');
    if (id === 'sleep') {
      const asleep = pv.anim.isSleeping;
      b.querySelector('svg').outerHTML = icon(asleep ? 'sun' : 'sleep');
      b.querySelector('.lbl').textContent = asleep ? 'Despertar' : 'Dormir';
      if (asleep) { w.textContent = ''; b.classList.remove('cool'); continue; }
    }
    if (!ACTIONS[id] || id === 'feed') { w.textContent = ''; continue; }
    const c = canDo(pet, id, null, now);
    b.classList.toggle('cool', !c.ok);
    w.textContent = c.waitMin ? `${c.waitMin} min` : (!c.ok ? 'hoy no' : '');
  }
  for (const f of document.querySelectorAll('#tray .food')) f.classList.toggle('cool', !canDo(pet, 'feed', f.dataset.food, now).ok);
}

const ANIM_REASON = { sleeping: 'Está dormido. Despiértalo primero.', busy: 'Espera a que termine.' };

async function perform(action, item) {
  const chk = canDo(pet, action, item, new Date());
  if (!chk.ok) { toast(chk.reason); return; }
  let r;
  if (action === 'feed') r = pv.feed(FOODS.find((f) => f.id === item));
  else if (action === 'pet') { r = pv.act('pet'); if (r.ok && !r.sleeping) setTimeout(() => pv.anim.release('pet'), 2400); }
  else if (action === 'sleep') r = pv.act('fallAsleep');
  else r = pv.act(action);
  if (!r.ok) { toast(ANIM_REASON[r.reason] || 'Ahora no puede.'); return; }
  const res = await backend.act(action, item);
  if (res.pet) pet = res.pet;
  if (!res.ok) toast(res.reason);
  else if (res.pending) toast('Sin conexión: se enviará al volver Internet.');
  checkMilestones();
  render();
}

$('#dock').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.dataset.act;
  if (id === 'feed') { $('#tray').hidden = !$('#tray').hidden; return; }
  $('#tray').hidden = true;
  if (id === 'sleep' && pv.anim.isSleeping) { const r = pv.act('wakeUp'); if (!r.ok) toast(ANIM_REASON[r.reason] || 'Espera un momento.'); return; }
  if (id === 'dance') { const r = pv.act('dance'); if (!r.ok) toast(ANIM_REASON[r.reason] || 'Ahora no puede.'); return; }
  perform(id);
});
$('#tray').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $('#tray').hidden = true;
  perform('feed', b.dataset.food);
});

// Acariciar con el dedo cuenta como cuidado (con su tiempo de espera); tocar solo es una reacción.
function onPetTouch(kind, r) {
  if (!r.ok) { toast(ANIM_REASON[r.reason] || 'Ahora no puede.'); return; }
  if (r.woke) toast('¡Lo despertaste!');
  if (kind === 'pet' && canDo(pet, 'pet', null, new Date()).ok) {
    backend.act('pet', null).then((res) => { if (res.pet) pet = res.pet; render(); });
  }
}

function checkMilestones() {
  const best = pet.state.bestStreak;
  const key = `mascota.milestone.${pet.id}`;
  const got = +LS.get(key) || 0;
  const m = MILESTONES.filter((x) => x <= best).pop();
  if (m && m > got) {
    LS.set(key, String(m));
    pv.act('celebrate');
    banner(`¡${m} días juntos cuidando a ${pet.name}!`, 'Racha compartida conseguida.');
  }
}

// ---------------------------------------------------------------- mudanza
$('#btn-restart').addEventListener('click', () => { $('#restart-confirm').hidden = false; });
$('#btn-restart-no').addEventListener('click', () => { $('#restart-confirm').hidden = true; });
$('#btn-restart-yes').addEventListener('click', async () => {
  pet = await backend.resetPet(localDay(new Date(), pet.tz));
  LS.set(`mascota.seenStage.${pet.id}`, '1');
  $('#restart-confirm').hidden = true;
  pv.setStage(1); paint(STAGES[0]);
  render();
  banner(`${pet.name} ha vuelto`, 'Empieza una nueva etapa. Cuidadlo cada día.');
});

// ---------------------------------------------------------------- navegación
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  currentView = b.dataset.view;
  document.querySelectorAll('.tabbar button').forEach((x) => (x === b ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current')));
  for (const v of ['home', 'history', 'settings']) $('#view-' + v).hidden = v !== currentView;
  if (currentView === 'home') pv.start(); else pv.stop();
  if (currentView === 'history') renderHistory();
  if (currentView === 'settings') renderSettings();
  window.scrollTo(0, 0);
});

// ---------------------------------------------------------------- historial
async function renderHistory() {
  const d = derive(pet, new Date(), backend.meId);
  const today = d.today, yesterday = addDays(today, -1);
  const seen = (m) => {
    const t = m.lastCareAt || m.lastSeenAt;
    if (!t) return 'aún no lo ha cuidado';
    const day = localDay(new Date(t), pet.tz);
    return `${day === today ? 'hoy' : day === yesterday ? 'ayer' : fmtDate(day)} ${fmtTime(t)}`;
  };
  $('#summary').innerHTML = `
    <div class="card"><b>${d.age}</b><span>días de edad</span></div>
    <div class="card"><b>${d.streak}</b><span>racha (récord ${pet.state.bestStreak})</span></div>
    <div class="card"><b>${pet.state.careDaysTotal}</b><span>días cuidado</span></div>
    <div class="card members">${pet.members.map((m) => `<div><span>${esc(m.name)}</span><small>Último cuidado: ${esc(seen(m))}</small></div>`).join('') || '<div>Solo tú por ahora</div>'}</div>`;
  $('#badges').innerHTML = MILESTONES.map((m) => `<span class="badge${pet.state.bestStreak >= m ? ' on' : ''}">${m} días</span>`).join('')
    + (pet.state.evolutions || []).map((e) => `<span class="badge on">${esc(stageById(e.stage).title)} · ${fmtDate(localDay(new Date(e.at), pet.tz))}</span>`).join('');
  let logs = [];
  try { logs = await backend.history(); } catch (e) { $('#log').innerHTML = `<li class="empty">${esc(e.message)}</li>`; return; }
  if (!logs.length) { $('#log').innerHTML = '<li class="empty">Todavía no hay cuidados. ¡Dale de comer!</li>'; return; }
  let html = '', lastDay = '';
  for (const l of logs) {
    const day = localDay(new Date(l.at), pet.tz);
    if (day !== lastDay) { html += `<li class="day">${day === today ? 'Hoy' : day === yesterday ? 'Ayer' : fmtDate(day)}</li>`; lastDay = day; }
    html += `<li class="item"><span>${esc(l.name)} ${esc(describe(l.action, l.item))}</span><time>${fmtTime(l.at)}</time></li>`;
  }
  $('#log').innerHTML = html;
}

// ---------------------------------------------------------------- ajustes
function renderSettings() {
  $('#set-name').value = pet.name;
  const local = backend.mode === 'local';
  $('#names-fields').innerHTML = local
    ? pet.members.map((m, i) => `<label for="set-m${i}">Cuidador ${i + 1}</label><input id="set-m${i}" data-id="${m.id}" maxlength="24" required value="${esc(m.name)}">`).join('')
    : `<label for="set-me">Tu nombre</label><input id="set-me" maxlength="24" required value="${esc(pet.members.find((m) => m.id === backend.meId)?.name || '')}">`
      + `<p class="small">${pet.members.length < 2 ? 'Tu pareja aún no se ha unido.' : `Tu pareja: ${esc(pet.members.find((m) => m.id !== backend.meId)?.name)}`}</p>`;
  $('#invite-card').hidden = local || !pet.inviteCode;
  $('#invite-code').textContent = pet.inviteCode || '';
  $('#set-birth').value = pet.birthDate;
  $('#set-d2').value = pet.settings.stageDays[1];
  $('#set-d3').value = pet.settings.stageDays[2];
  $('#time-fields').hidden = true; $('#time-fields').disabled = true; $('#btn-unlock').hidden = false;
  $('#import-label').hidden = !local;
  $('#conn-info').textContent = local
    ? 'Modo local: los datos viven solo en este navegador y no se comparten.'
    : `Compartido mediante Supabase (${(LS.get('mascota.sb.url') || CONFIG.SUPABASE_URL).replace('https://', '')}).`;
}
$('#f-petname').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { pet = await backend.updatePet({ name: $('#set-name').value.trim() }); render(); toast('Nombre guardado'); } catch (err) { toast(err.message); }
});
$('#f-myname').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (backend.mode === 'local') for (const inp of document.querySelectorAll('#names-fields input')) pet = await backend.setMemberName(inp.dataset.id, inp.value.trim());
    else pet = await backend.setMyName($('#set-me').value.trim());
    render(); toast('Nombres guardados');
  } catch (err) { toast(err.message); }
});
$('#btn-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(pet.inviteCode); toast('Código copiado'); }
  catch { const r = document.createRange(); r.selectNodeContents($('#invite-code')); getSelection().removeAllRanges(); getSelection().addRange(r); }
});
$('#btn-unlock').addEventListener('click', () => { $('#time-fields').hidden = false; $('#time-fields').disabled = false; $('#btn-unlock').hidden = true; });
$('#f-time').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d2 = +$('#set-d2').value, d3 = +$('#set-d3').value;
  if (!(d2 > 0 && d3 > d2)) { $('#time-err').textContent = 'La tercera etapa debe ser posterior a la segunda.'; return; }
  try {
    pet = await backend.updatePet({ birthDate: $('#set-birth').value, settings: { stageDays: [0, d2, d3], minCareDays: pet.settings.minCareDays } });
    $('#time-err').textContent = '';
    renderSettings(); render(); toast('Cambios guardados');
  } catch (err) { $('#time-err').textContent = err.message; }
});
$('#btn-export').addEventListener('click', async () => {
  const json = await backend.exportData();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `${pet.name.toLowerCase()}-copia-${localDay(new Date(), pet.tz)}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('#in-import').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { pet = await backend.importData(await f.text()); render(); renderSettings(); toast('Copia restaurada'); } catch (err) { toast(err.message); }
});
$('#btn-switch').addEventListener('click', () => {
  LS.set('mascota.mode', 'choose');
  location.reload();
});

// refrescar al volver a la pestaña (puede haber pasado medianoche o haber cambios)
document.addEventListener('visibilitychange', () => { if (!document.hidden && pet && backend.mode === 'cloud') backend._refresh?.(); if (!document.hidden) render(); });

boot();
