// Reglas del juego (puras, sin DOM). Las usan la interfaz y el almacenamiento: cada cambio
// se valida aquí en el teléfono y, al sincronizar, se vuelve a aplicar sobre la versión
// más reciente guardada en GitHub (así un cambio duplicado o fuera de tiempo se rechaza).
//
// Reglas principales
//  - Edad: días reales desde la fecha de nacimiento (sigue contando con la app cerrada).
//  - Etapas: día 600 → segunda etapa, día 900 → tercera (configurable en Ajustes),
//    siempre que haya un mínimo de días con cuidados.
//  - Vidas: 3 por mes. Cada día completo en que NADIE lo cuida gasta una vida y al día
//    siguiente amanece triste. Si se gastan las 3 dentro del mismo mes, aparece la caja de
//    mudanza: «se independizó». El día 1 de cada mes vuelve a tener 3 vidas.
//  - Si ayer solo uno de los dos lo cuidó, hoy extraña al otro.
//  - Racha: días cuidándolo, empezando en el valor que elijáis (393). Un día sin cuidados
//    gasta una vida pero no rompe la racha (se congela ese día); solo se pierde si se muda.
//  - Días juntos: días en que ambos lo cuidaron (logros de 7, 30, 100, 180 y 350).
//  - Dormir: se acuesta en su cama durante 2 horas y no se le puede despertar antes.
//  - Límites: cada acción tiene un tiempo de espera y un máximo diario.

import { FOODS } from '../pet/food.js';

export const DEFAULT_SETTINGS = { stageDays: [0, 600, 900], minCareDays: [0, 20, 40] };
export const LIVES = 3;
export const STAT_FLOOR = 5;
export const SLEEP_MIN = 120;
export const DECAY_PER_HOUR = { hunger: 3.2, happiness: 2.4, energy: 2, hygiene: 1.6 };

export const ACTIONS = {
  feed: { label: 'Comer', cooldownMin: 3, dailyMax: 10 },
  pet: { label: 'Acariciar', cooldownMin: 2, dailyMax: 20, effect: { happiness: 6, xp: 1 } },
  play: { label: 'Jugar', cooldownMin: 10, dailyMax: 8, minEnergy: 15, effect: { happiness: 14, energy: -12, hunger: -6, xp: 5 } },
  bath: { label: 'Bañar', cooldownMin: 60, dailyMax: 4, effect: { hygiene: 45, happiness: 3, xp: 3 } },
  sleep: { label: 'Dormir', cooldownMin: SLEEP_MIN, dailyMax: 3, effect: { energy: 45, xp: 2 } },
};
export const FOOD_LIMITS = { estrella: 1, pastel: 3, onigiri: 3 }; // máximos diarios por alimento
export const KEEP_DAYS = 62;

const DAY_MS = 86400000;

export function localDay(date, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
const dayNum = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; };
export const dayDiff = (a, b) => dayNum(b) - dayNum(a);
export const addDays = (s, n) => new Date((dayNum(s) + n) * DAY_MS).toISOString().slice(0, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const maxDay = (a, b) => (a > b ? a : b);

export function newPetState(now, tz, streakStart = 0) {
  const today = localDay(now, tz);
  return {
    stats: { hunger: 70, happiness: 70, energy: 80, hygiene: 80 },
    statsAt: now.toISOString(),
    xp: 0, careDaysTotal: 0, lastCareDay: null, createdDay: today,
    days: {}, today: { day: today, counts: {}, last: {} },
    streak: streakStart, bestStreak: streakStart, streakDay: streakStart ? today : null, togetherDays: 0,
    sleepUntil: null, outfit: {}, movedOutAt: null, evolutions: [],
  };
}

export function currentStats(state, now) {
  const h = Math.max(0, (now - new Date(state.statsAt)) / 3600000);
  const out = {};
  for (const k in DECAY_PER_HOUR) out[k] = clamp((state.stats[k] ?? 50) - DECAY_PER_HOUR[k] * h, STAT_FLOOR, 100);
  return out;
}

// Días de este mes (hasta ayer) en que nadie lo cuidó.
export function missedThisMonth(pet, now) {
  const s = pet.state;
  const today = localDay(now, pet.tz);
  const from = maxDay(today.slice(0, 8) + '01', s.createdDay);
  const missed = [];
  for (let d = from; d < today; d = addDays(d, 1)) if (!(s.days[d] || []).length) missed.push(d);
  return missed;
}

export function neglect(pet, now) {
  const missedDays = missedThisMonth(pet, now);
  const missed = missedDays.length;
  const movedOut = !!pet.state.movedOutAt || missed >= LIVES;
  return { missed, missedDays, lives: Math.max(0, LIVES - missed), movedOut, movedOutDay: movedOut ? (pet.state.movedOutAt || missedDays[LIVES - 1]) : null };
}

export function sleepingUntil(pet, now) {
  const u = pet.state.sleepUntil;
  return u && new Date(u) > now ? new Date(u) : null;
}

export function ageInDays(pet, now) {
  return Math.max(0, dayDiff(pet.birthDate, localDay(now, pet.tz)));
}

export function stageFor(age, careDays, settings = DEFAULT_SETTINGS) {
  let id = 1;
  settings.stageDays.forEach((d, i) => { if (age >= d && careDays >= (settings.minCareDays[i] || 0)) id = i + 1; });
  return id;
}

export function nextEvolution(pet, now) {
  const st = pet.settings || DEFAULT_SETTINGS;
  const age = ageInDays(pet, now);
  const cur = stageFor(age, pet.state.careDaysTotal, st);
  if (cur >= st.stageDays.length) return null;
  const day = st.stageDays[cur];
  const needCare = Math.max(0, (st.minCareDays[cur] || 0) - pet.state.careDaysTotal);
  return { stageId: cur + 1, day, daysLeft: Math.max(0, day - age), needCare, date: addDays(pet.birthDate, day) };
}

// Estado visible: lo que la interfaz y el animador necesitan.
export function derive(pet, now, meId) {
  const st = pet.settings || DEFAULT_SETTINGS;
  const age = ageInDays(pet, now);
  const stats = currentStats(pet.state, now);
  const n = neglect(pet, now);
  const today = localDay(now, pet.tz), yesterday = addDays(today, -1);
  const careToday = (pet.state.days[today] || []).length > 0;
  const missedYesterday = n.missedDays.includes(yesterday);
  const cameYesterday = pet.state.days[yesterday] || [];
  let missing = null;
  if (pet.members.length >= 2 && cameYesterday.length === 1 && !careToday) {
    missing = pet.members.find((m) => !cameYesterday.includes(m.id))?.name || null;
  }
  const sleep = sleepingUntil(pet, now);
  let mood = 'neutral', message = null;
  if (n.movedOut) mood = 'sad';
  else if (sleep) { mood = 'sleepy'; }
  else if (missedYesterday && !careToday) {
    mood = 'sad';
    message = n.lives === 1 ? 'Nadie vino ayer. Solo le queda una vida este mes.' : `Nadie vino ayer. Le quedan ${n.lives} vidas este mes.`;
  }
  else if (missing) { mood = 'sad'; message = `Extraña a ${missing}.`; }
  else if (stats.hunger < 35) { mood = 'hungry'; message = 'Tiene hambre.'; }
  else if (stats.energy < 25) { mood = 'sleepy'; message = 'Tiene sueño.'; }
  else if (stats.happiness > 70 && stats.hunger > 50) { mood = 'happy'; }
  return {
    age, stageId: stageFor(age, pet.state.careDaysTotal, st), stats, ...n, mood, message, sleepUntil: sleep,
    next: nextEvolution(pet, now), streak: n.movedOut ? 0 : pet.state.streak, careToday, today,
    me: pet.members.find((m) => m.id === meId) || null,
  };
}

// ¿Se puede hacer esta acción ahora? → { ok, reason, waitMin }
export function canDo(pet, action, item, now, memberId = null) {
  const def = ACTIONS[action];
  if (!def) return { ok: false, reason: 'Acción desconocida.' };
  if (neglect(pet, now).movedOut) return { ok: false, reason: `${pet.name} ya se independizó.` };
  const sleep = sleepingUntil(pet, now);
  if (sleep) {
    const hh = sleep.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    return { ok: false, reason: `Está durmiendo. Despierta a las ${hh}.`, sleeping: true };
  }
  const today = localDay(now, pet.tz);
  const t = pet.state.today.day === today ? pet.state.today : { counts: {}, last: {} };
  const key = action === 'feed' ? `feed:${item}` : action;
  if (action === 'feed') {
    const food = FOODS.find((f) => f.id === item);
    if (!food) return { ok: false, reason: 'Ese alimento no existe.' };
    const cap = FOOD_LIMITS[item];
    if (cap && (t.counts[key] || 0) >= cap) return { ok: false, reason: `Ya comió ${food.name.toLowerCase()} hoy.` };
  }
  if ((t.counts[action] || 0) >= def.dailyMax) return { ok: false, reason: 'Ya hizo eso bastante por hoy.' };
  // el tiempo de espera es de cada cuidador (así los dos pueden cuidarlo a la vez)
  const last = action === 'sleep' ? t.last[action] : (t.last[`${action}:${memberId}`] || (memberId ? null : t.last[action]));
  if (last) {
    const wait = def.cooldownMin - (now - new Date(last)) / 60000;
    if (wait > 0) return { ok: false, reason: `Espera ${Math.ceil(wait)} min.`, waitMin: Math.ceil(wait) };
  }
  if (def.minEnergy && currentStats(pet.state, now).energy < def.minEnergy) return { ok: false, reason: 'Está demasiado cansado para jugar.' };
  return { ok: true };
}

// Aplica una acción (pura): devuelve una copia del pet y la entrada del historial.
export function applyAction(pet, { action, item = null, memberId }, now) {
  const chk = canDo(pet, action, item, now, memberId);
  if (!chk.ok) { const e = new Error(chk.reason); e.rule = true; throw e; }
  const p = structuredClone(pet);
  const s = p.state;
  const today = localDay(now, p.tz);
  s.stats = currentStats(s, now);
  s.statsAt = now.toISOString();
  const eff = action === 'feed' ? FOODS.find((f) => f.id === item).effect : ACTIONS[action].effect;
  for (const k of ['hunger', 'happiness', 'energy', 'hygiene']) if (eff[k]) s.stats[k] = clamp(s.stats[k] + eff[k], STAT_FLOOR, 100);
  s.xp += eff.xp || 0;
  if (action === 'sleep') s.sleepUntil = new Date(now.getTime() + SLEEP_MIN * 60000).toISOString();
  if (s.today.day !== today) s.today = { day: today, counts: {}, last: {} };
  s.today.counts[action] = (s.today.counts[action] || 0) + 1;
  if (action === 'feed') s.today.counts[`feed:${item}`] = (s.today.counts[`feed:${item}`] || 0) + 1;
  s.today.last[action] = now.toISOString();
  s.today.last[`${action}:${memberId}`] = now.toISOString();
  // día de cuidado + racha (los días sin cuidado cubiertos por una vida no la rompen)
  if (s.lastCareDay !== today) s.careDaysTotal += 1;
  s.lastCareDay = today;
  if (s.streakDay !== today) { s.streak += 1; s.streakDay = today; s.bestStreak = Math.max(s.bestStreak, s.streak); }
  const list = s.days[today] || (s.days[today] = []);
  const before = new Set(list).size;
  if (!list.includes(memberId)) list.push(memberId);
  if (before < 2 && new Set(list).size >= 2) s.togetherDays = (s.togetherDays || 0) + 1;
  for (const d of Object.keys(s.days)) if (dayDiff(d, today) > KEEP_DAYS) delete s.days[d];
  const m = p.members.find((x) => x.id === memberId);
  if (m) m.lastCareAt = now.toISOString();
  const log = { id: crypto.randomUUID?.() || String(Math.random()), memberId, name: m?.name || '?', action, item, at: now.toISOString() };
  return { pet: p, log };
}

export const MILESTONES = [7, 30, 100, 180, 350];
