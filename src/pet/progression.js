// Progresión por tiempo real. La edad se calcula con fechas (no con contadores),
// así que sigue avanzando aunque la aplicación esté cerrada.

import { STAGES } from './stages.js';

const DAY = 86400000;

// Días completos transcurridos desde el nacimiento, en el calendario local.
export function ageInDays(birthISO, now = new Date()) {
  const [y, m, d] = birthISO.split('-').map(Number);
  const birth = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - birth) / DAY));
}

// Umbrales configurables (por defecto 600 y 900 días).
export function stageForAge(age, starts = STAGES.map((s) => s.defaultStartDay)) {
  let id = 1;
  STAGES.forEach((s, i) => { if (age >= starts[i]) id = s.id; });
  return id;
}

export function nextEvolution(age, starts = STAGES.map((s) => s.defaultStartDay)) {
  const i = starts.findIndex((d) => d > age);
  if (i < 0) return null;
  return { stageId: STAGES[i].id, day: starts[i], daysLeft: starts[i] - age };
}
