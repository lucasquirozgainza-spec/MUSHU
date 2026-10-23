// Pruebas de las reglas: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPetState, derive, applyAction, canDo, neglect, ageInDays, stageFor, localDay, DEFAULT_SETTINGS } from '../src/app/rules.js';

const TZ = 'America/La_Paz';
const at = (s) => new Date(s); // fechas con zona -04:00
function makePet(now, birth = '2025-09-25') {
  return {
    id: 'p1', name: 'Mushu', birthDate: birth, tz: TZ, settings: structuredClone(DEFAULT_SETTINGS),
    members: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Leo' }], state: newPetState(now, TZ),
  };
}

test('la edad se calcula con fechas reales', () => {
  const now = at('2026-10-23T09:00:00-04:00');
  const pet = makePet(now);
  assert.equal(ageInDays(pet, now), 393);
  // una semana después, sin abrir la app
  assert.equal(ageInDays(pet, at('2026-10-30T23:30:00-04:00')), 400);
});

test('las etapas cambian a los 600 y 900 días (con cuidados mínimos)', () => {
  assert.equal(stageFor(393, 0), 1);
  assert.equal(stageFor(599, 50), 1);
  assert.equal(stageFor(600, 50), 2);
  assert.equal(stageFor(600, 5), 1, 'sin cuidados suficientes espera, sin perder edad');
  assert.equal(stageFor(900, 50), 3);
});

test('un día sin cuidados: triste y 2 vidas; tres días: se independiza', () => {
  const d0 = at('2026-10-23T10:00:00-04:00');
  let pet = applyAction(makePet(d0), { action: 'pet', memberId: 'a' }, d0).pet;
  assert.equal(neglect(pet, at('2026-10-24T20:00:00-04:00')).lives, 3, 'al día siguiente aún hay tiempo');
  const d2 = derive(pet, at('2026-10-25T08:00:00-04:00'), 'a');
  assert.equal(d2.lives, 2); assert.equal(d2.mood, 'sad'); assert.equal(d2.movedOut, false);
  assert.equal(neglect(pet, at('2026-10-26T08:00:00-04:00')).lives, 1);
  const d4 = neglect(pet, at('2026-10-27T08:00:00-04:00'));
  assert.equal(d4.movedOut, true);
  assert.equal(canDo(pet, 'pet', null, at('2026-10-27T08:00:00-04:00')).ok, false);
});

test('cuidarlo devuelve las vidas', () => {
  const d0 = at('2026-10-23T10:00:00-04:00');
  let pet = applyAction(makePet(d0), { action: 'pet', memberId: 'a' }, d0).pet;
  const d2 = at('2026-10-25T09:00:00-04:00');
  pet = applyAction(pet, { action: 'pet', memberId: 'b' }, d2).pet;
  assert.equal(derive(pet, d2, 'a').lives, 3);
});

test('si ayer solo vino uno, extraña al otro', () => {
  const d0 = at('2026-10-23T10:00:00-04:00');
  const pet = applyAction(makePet(d0), { action: 'pet', memberId: 'a' }, d0).pet;
  const d = derive(pet, at('2026-10-24T09:00:00-04:00'), 'a');
  assert.equal(d.mood, 'sad'); assert.match(d.message, /Leo/);
});

test('alimentar modifica las estadísticas y respeta límites', () => {
  const d0 = at('2026-10-23T10:00:00-04:00');
  const pet0 = makePet(d0);
  const { pet, log } = applyAction(pet0, { action: 'feed', item: 'manzana', memberId: 'a' }, d0);
  assert.ok(pet.state.stats.hunger > pet0.state.stats.hunger);
  assert.equal(log.name, 'Ana');
  assert.equal(canDo(pet, 'feed', 'galleta', d0).ok, false, 'tiempo de espera');
  let p = applyAction(pet, { action: 'feed', item: 'estrella', memberId: 'a' }, at('2026-10-23T10:05:00-04:00')).pet;
  assert.equal(canDo(p, 'feed', 'estrella', at('2026-10-23T12:00:00-04:00')).ok, false, 'premio raro una vez al día');
});

test('racha: días en que ambos cuidaron', () => {
  let pet = makePet(at('2026-10-23T08:00:00-04:00'));
  for (const day of ['23', '24', '25']) {
    pet = applyAction(pet, { action: 'pet', memberId: 'a' }, at(`2026-10-${day}T09:00:00-04:00`)).pet;
    pet = applyAction(pet, { action: 'pet', memberId: 'b' }, at(`2026-10-${day}T21:00:00-04:00`)).pet;
  }
  assert.equal(pet.state.streak, 3);
  assert.equal(derive(pet, at('2026-10-27T09:00:00-04:00'), 'a').streak, 0, 'se rompe pero no afecta a la edad');
});

test('las estadísticas bajan con el tiempo pero nunca a cero', () => {
  const d0 = at('2026-10-23T10:00:00-04:00');
  const pet = makePet(d0);
  const s = derive(pet, at('2026-11-20T10:00:00-04:00'), 'a').stats;
  assert.equal(s.hunger, 5);
  assert.equal(localDay(at('2026-10-23T23:30:00-04:00'), TZ), '2026-10-23');
});
