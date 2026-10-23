// Pruebas de las reglas: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPetState, derive, applyAction, canDo, neglect, ageInDays, stageFor, localDay, DEFAULT_SETTINGS } from '../src/app/rules.js';

const TZ = 'America/La_Paz';
const at = (s) => new Date(s);
function makePet(now, { birth = '2025-09-25', streak = 393 } = {}) {
  return {
    id: 'p1', name: 'Mushu', birthDate: birth, tz: TZ, settings: structuredClone(DEFAULT_SETTINGS),
    members: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Leo' }], state: newPetState(now, TZ, streak),
  };
}
const care = (pet, who, iso) => applyAction(pet, { action: 'pet', memberId: who }, at(iso)).pet;

test('la edad se calcula con fechas reales', () => {
  const now = at('2026-10-23T09:00:00-04:00');
  const pet = makePet(now);
  assert.equal(ageInDays(pet, now), 393);
  assert.equal(ageInDays(pet, at('2026-10-30T23:30:00-04:00')), 400);
});

test('las etapas cambian a los 600 y 900 días (con cuidados mínimos)', () => {
  assert.equal(stageFor(393, 0), 1);
  assert.equal(stageFor(600, 50), 2);
  assert.equal(stageFor(600, 5), 1, 'sin cuidados suficientes espera, sin perder edad');
  assert.equal(stageFor(900, 50), 3);
});

test('la racha empieza en 393 y sube un día por cada día cuidado', () => {
  let pet = makePet(at('2026-10-23T08:00:00-04:00'));
  assert.equal(derive(pet, at('2026-10-23T08:00:00-04:00'), 'a').streak, 393);
  pet = care(pet, 'a', '2026-10-23T09:00:00-04:00');
  assert.equal(pet.state.streak, 393, 'el día de hoy ya estaba contado');
  pet = care(pet, 'a', '2026-10-24T09:00:00-04:00');
  assert.equal(pet.state.streak, 394);
  // un día sin cuidados gasta una vida pero no rompe la racha
  pet = care(pet, 'b', '2026-10-26T09:00:00-04:00');
  assert.equal(pet.state.streak, 395);
  assert.equal(derive(pet, at('2026-10-26T10:00:00-04:00'), 'a').lives, 2);
});

test('vidas por mes: cada día sin cuidados gasta una y no se recupera hasta el mes siguiente', () => {
  let pet = makePet(at('2026-10-01T08:00:00-04:00'));
  pet = care(pet, 'a', '2026-10-01T09:00:00-04:00');
  // nadie el 2
  pet = care(pet, 'a', '2026-10-03T09:00:00-04:00');
  assert.equal(derive(pet, at('2026-10-03T10:00:00-04:00'), 'a').lives, 2, 'cuidarlo no devuelve la vida');
  // nadie el 4
  const d5 = derive(pet, at('2026-10-05T08:00:00-04:00'), 'a');
  assert.equal(d5.lives, 1); assert.equal(d5.mood, 'sad'); assert.match(d5.message, /una vida/);
  // 1 de noviembre: vuelve a tener 3 (si cuidan todos los días restantes)
  for (let d = 5; d <= 31; d++) pet = care(pet, 'a', `2026-10-${String(d).padStart(2, '0')}T09:00:00-04:00`);
  assert.equal(derive(pet, at('2026-11-01T09:00:00-04:00'), 'a').lives, 3);
});

test('tres días sin cuidados en el mismo mes: se independiza', () => {
  let pet = makePet(at('2026-10-01T08:00:00-04:00'));
  pet = care(pet, 'a', '2026-10-01T09:00:00-04:00');
  pet = care(pet, 'a', '2026-10-03T09:00:00-04:00'); // falta el 2
  pet = care(pet, 'a', '2026-10-05T09:00:00-04:00'); // falta el 4
  const n = neglect(pet, at('2026-10-07T09:00:00-04:00')); // falta el 6
  assert.equal(n.movedOut, true);
  assert.equal(n.movedOutDay, '2026-10-06');
  assert.equal(canDo(pet, 'pet', null, at('2026-10-07T09:00:00-04:00')).ok, false);
});

test('si ayer solo vino uno, extraña al otro', () => {
  const pet = care(makePet(at('2026-10-23T08:00:00-04:00')), 'a', '2026-10-23T10:00:00-04:00');
  const d = derive(pet, at('2026-10-24T09:00:00-04:00'), 'a');
  assert.equal(d.mood, 'sad'); assert.match(d.message, /Leo/);
});

test('dormir: 2 horas en la cama sin poder hacer otras cosas', () => {
  const d0 = at('2026-10-23T22:00:00-04:00');
  const pet = applyAction(makePet(d0), { action: 'sleep', memberId: 'a' }, d0).pet;
  const r = canDo(pet, 'feed', 'manzana', at('2026-10-23T23:30:00-04:00'));
  assert.equal(r.ok, false); assert.equal(r.sleeping, true);
  assert.ok(derive(pet, at('2026-10-23T23:00:00-04:00'), 'a').sleepUntil);
  assert.equal(canDo(pet, 'feed', 'manzana', at('2026-10-24T00:01:00-04:00')).ok, true);
});

test('alimentar modifica las estadísticas y respeta límites', () => {
  const d0 = at('2026-10-23T10:00:00-04:00');
  const pet0 = makePet(d0);
  const { pet, log } = applyAction(pet0, { action: 'feed', item: 'manzana', memberId: 'a' }, d0);
  assert.ok(pet.state.stats.hunger > pet0.state.stats.hunger);
  assert.equal(log.name, 'Ana');
  assert.equal(canDo(pet, 'feed', 'galleta', d0).ok, false, 'tiempo de espera');
  const p = applyAction(pet, { action: 'feed', item: 'estrella', memberId: 'a' }, at('2026-10-23T10:05:00-04:00')).pet;
  assert.equal(canDo(p, 'feed', 'estrella', at('2026-10-23T12:00:00-04:00')).ok, false, 'premio raro una vez al día');
});

test('días juntos: cuando los dos lo cuidan el mismo día', () => {
  let pet = makePet(at('2026-10-23T08:00:00-04:00'));
  pet = care(pet, 'a', '2026-10-23T09:00:00-04:00');
  pet = care(pet, 'b', '2026-10-23T21:00:00-04:00');
  assert.equal(pet.state.togetherDays, 1);
});

test('las estadísticas bajan con el tiempo pero nunca a cero', () => {
  const pet = makePet(at('2026-10-23T10:00:00-04:00'));
  assert.equal(derive(pet, at('2026-11-20T10:00:00-04:00'), 'a').stats.hunger, 5);
  assert.equal(localDay(at('2026-10-23T23:30:00-04:00'), TZ), '2026-10-23');
});

test('cada cuidador tiene su propio tiempo de espera', () => {
  const d0 = at('2026-10-23T10:00:00-04:00');
  let pet = makePet(d0);
  pet = applyAction(pet, { action: 'feed', item: 'manzana', memberId: 'a' }, d0).pet;
  const d1 = at('2026-10-23T10:01:00-04:00');
  assert.equal(canDo(pet, 'feed', 'galleta', d1, 'a').ok, false, 'Ana espera');
  assert.equal(canDo(pet, 'feed', 'galleta', d1, 'b').ok, true, 'Leo puede darle de comer');
});
