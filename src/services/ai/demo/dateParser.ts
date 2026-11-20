/**
 * Extrae fechas en español relativas a "hoy" en America/Bogota.
 *
 * Reglas (documentadas también en docs/INTERPRETACION.md):
 *  - "mañana" = hoy + 1; "pasado mañana" = hoy + 2.
 *  - "este viernes" = el viernes de esta semana en adelante (hoy si hoy es viernes).
 *  - "el próximo viernes" / "el viernes que viene" = siguiente viernes estrictamente después de hoy.
 *  - "el viernes" (sin más): siguiente viernes; si HOY es viernes es ambiguo → se pregunta.
 *  - "el viernes de la próxima semana" = viernes de la semana calendario siguiente (lunes a domingo).
 *  - "dentro de 3 días" / "en 3 días" = hoy + 3.
 *  - "el 25" = próximo día 25 (este mes si no ha pasado, si no el siguiente).
 *  - "25 de diciembre", "25/12", "25/12/2026": sin año → próxima ocurrencia.
 *  - "la próxima semana", "el próximo mes", "este fin de semana", "en diciembre": ambiguos → se pregunta.
 */
import type { DateKey, QuickReply } from '@/domain/types';
import {
  addDays,
  addMonths,
  daysInMonth,
  endOfMonth,
  isValidDate,
  makeDateKey,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  weekday,
  endOfWeek,
} from '@/lib/dates';
import { formatDate, WEEKDAYS, capitalize } from '@/lib/format';
import { MONTH, MONTH_INDEX, NUM, WEEKDAY, WEEKDAY_INDEX, parseNumber } from './numbers';
import type { Utterance } from './utterance';

export type DateResult =
  | { kind: 'date'; date: DateKey; deadline: boolean }
  | { kind: 'ambiguous'; question: string; options: QuickReply[] }
  | { kind: 'invalid'; message: string }
  | null;

const PREFIX = '(?:(?:para|desde|hasta|al|antes\\s+del?|a\\s+mas\\s+tardar\\s+(?:el|este)?|el|este|esta|del?|el\\s+dia|dia)\\s+)*';

function dateOption(date: DateKey): QuickReply {
  const label = `${capitalize(WEEKDAYS[weekday(date)])} ${formatDate(date).slice(0, 5)}`;
  return { label, value: `El ${WEEKDAYS[weekday(date)]} ${formatDate(date)}` };
}

/** Siguiente fecha con ese día de la semana; `includeToday` decide si hoy cuenta. */
export function nextWeekday(today: DateKey, target: number, includeToday: boolean): DateKey {
  let delta = (target - weekday(today) + 7) % 7;
  if (delta === 0 && !includeToday) delta = 7;
  return addDays(today, delta);
}

function resolveDayMonth(today: DateKey, day: number, month: number, year?: number): DateResult {
  const { year: ty } = parseDateKey(today);
  if (year !== undefined) {
    if (!isValidDate(year, month, day)) return { kind: 'invalid', message: `La fecha ${day}/${month}/${year} no existe.` };
    return { kind: 'date', date: makeDateKey(year, month, day), deadline: false };
  }
  if (!isValidDate(ty, month, day) && !isValidDate(ty + 1, month, day)) {
    return { kind: 'invalid', message: `El ${day}/${String(month).padStart(2, '0')} no es una fecha válida.` };
  }
  let candidate = isValidDate(ty, month, day) ? makeDateKey(ty, month, day) : null;
  if (!candidate || candidate < today) candidate = isValidDate(ty + 1, month, day) ? makeDateKey(ty + 1, month, day) : null;
  if (!candidate) return { kind: 'invalid', message: 'Esa fecha no es válida.' };
  return { kind: 'date', date: candidate, deadline: false };
}

function isDeadlinePrefix(text: string): boolean {
  return /antes\s+del?|a\s+mas\s+tardar|hasta/.test(text);
}

export function extractDate(u: Utterance, today: DateKey): DateResult {
  const found = (m: RegExpExecArray, date: DateKey): DateResult => {
    u.consumeMatch(m);
    return { kind: 'date', date, deadline: isDeadlinePrefix(m[0]) };
  };
  let m: RegExpExecArray | null;

  // Pasado mañana / mañana (no "de la mañana", que es una hora).
  if ((m = u.match(new RegExp(`\\b${PREFIX}pasado\\s+manana\\b`)))) return found(m, addDays(today, 2));
  // El lookbehind evita "por la mañana", "de la mañana" y "esta mañana".
  if ((m = u.match(new RegExp(`(?<!\\b(?:la|esta)\\s+)\\b${PREFIX}manana\\b`)))) return found(m, addDays(today, 1));
  if ((m = u.match(new RegExp(`\\b${PREFIX}(?:hoy|esta\\s+(?:noche|tarde|manana))\\b`)))) return found(m, today);

  // Dentro de N días/semanas/meses.
  if ((m = u.match(new RegExp(`\\b(?:dentro\\s+de|en)\\s+(${NUM})\\s+(dias?|semanas?|mes(?:es)?)\\b`)))) {
    const n = parseNumber(m[1]);
    if (n != null) {
      const unit = m[2];
      const date = unit.startsWith('dia') ? addDays(today, n) : unit.startsWith('semana') ? addDays(today, n * 7) : addMonths(today, n);
      return found(m, date);
    }
  }

  // 25 de diciembre (de 2026).
  if ((m = u.match(new RegExp(`\\b${PREFIX}(${NUM})\\s+de\\s+${MONTH}(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`)))) {
    const day = parseNumber(m[1]);
    const month = MONTH_INDEX[m[2]];
    if (day != null) {
      const r = resolveDayMonth(today, day, month, m[3] ? Number(m[3]) : undefined);
      u.consumeMatch(m);
      return r && r.kind === 'date' ? { ...r, deadline: isDeadlinePrefix(m[0]) } : r;
    }
  }

  // 25/12 o 25/12/2026 (DD/MM/AAAA).
  if ((m = u.match(new RegExp(`\\b${PREFIX}(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?\\b`)))) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
    const r = resolveDayMonth(today, Number(m[1]), Number(m[2]), year);
    u.consumeMatch(m);
    return r && r.kind === 'date' ? { ...r, deadline: isDeadlinePrefix(m[0]) } : r;
  }

  // Día de la semana de la próxima semana.
  if (
    (m = u.match(
      new RegExp(`\\b${PREFIX}${WEEKDAY}\\s+de\\s+la\\s+(?:(?:proxima|otra|siguiente)\\s+semana|semana\\s+que\\s+viene)\\b`),
    ))
  ) {
    const target = WEEKDAY_INDEX[m[1]];
    const nextMonday = addDays(startOfWeek(today), 7);
    return found(m, addDays(nextMonday, (target + 6) % 7));
  }

  // Próximo viernes / viernes que viene.
  if (
    (m = u.match(new RegExp(`\\b${PREFIX}(?:proximo|siguiente)\\s+${WEEKDAY}\\b`))) ||
    (m = u.match(new RegExp(`\\b${PREFIX}${WEEKDAY}\\s+(?:que\\s+viene|proximo|siguiente)\\b`)))
  ) {
    return found(m, nextWeekday(today, WEEKDAY_INDEX[m[1]], false));
  }

  // Este viernes.
  if ((m = u.match(new RegExp(`\\b(?:para\\s+)?este\\s+${WEEKDAY}\\b`)))) {
    return found(m, nextWeekday(today, WEEKDAY_INDEX[m[1]], true));
  }

  // El viernes (sin calificativo).
  if ((m = u.match(new RegExp(`\\b${PREFIX}${WEEKDAY}\\b`)))) {
    const target = WEEKDAY_INDEX[m[1]];
    if (target === weekday(today)) {
      u.consumeMatch(m);
      const next = addDays(today, 7);
      return {
        kind: 'ambiguous',
        question: `Hoy es ${WEEKDAYS[target]}. ¿Te refieres a hoy (${formatDate(today)}) o al ${WEEKDAYS[target]} de la próxima semana (${formatDate(next)})?`,
        options: [{ label: `Hoy ${formatDate(today).slice(0, 5)}`, value: `Hoy ${formatDate(today)}` }, dateOption(next)],
      };
    }
    return found(m, nextWeekday(today, target, false));
  }

  // Fin de mes.
  if ((m = u.match(/\b(?:para\s+|a\s+)?(?:el\s+)?(?:fin|finales|ultimo\s+dia)\s+del?\s+mes\b/))) {
    return found(m, endOfMonth(today));
  }

  // El 25 / el día 25.
  if ((m = u.match(new RegExp(`\\b(?:para\\s+|antes\\s+)?(?:el\\s+dia|el|dia|del)\\s+(\\d{1,2})\\b(?!\\s*(?::|a\\.?\\s?m|p\\.?\\s?m|de\\s+la|mil|millon|pesos|%|/|\\d))`)))) {
    const day = Number(m[1]);
    if (day >= 1 && day <= 31) {
      const { year, month } = parseDateKey(today);
      let candidate: DateKey | null = day <= daysInMonth(year, month) ? makeDateKey(year, month, day) : null;
      if (!candidate || candidate < today) {
        const next = addMonths(startOfMonth(today), 1);
        const p = parseDateKey(next);
        candidate = day <= daysInMonth(p.year, p.month) ? makeDateKey(p.year, p.month, day) : null;
      }
      u.consumeMatch(m);
      if (!candidate) return { kind: 'invalid', message: `El día ${day} no existe en los próximos meses.` };
      return { kind: 'date', date: candidate, deadline: isDeadlinePrefix(m[0]) };
    }
  }

  // ── Expresiones ambiguas: se pregunta en lugar de inventar ──
  if ((m = u.match(/\b(?:este\s+|el\s+)?fin\s+de\s+semana\b/))) {
    u.consumeMatch(m);
    const sat = nextWeekday(today, 6, true);
    const sun = weekday(today) === 0 ? today : nextWeekday(today, 0, true);
    return { kind: 'ambiguous', question: '¿Qué día del fin de semana?', options: [dateOption(sat), dateOption(sun)] };
  }
  if ((m = u.match(/\b(?:para\s+)?(?:la\s+)?(?:(?:proxima|siguiente|otra)\s+semana|semana\s+que\s+viene)\b/))) {
    u.consumeMatch(m);
    const monday = addDays(startOfWeek(today), 7);
    return {
      kind: 'ambiguous',
      question: '¿Qué día de la próxima semana?',
      options: [0, 1, 2, 3, 4].map((i) => dateOption(addDays(monday, i))),
    };
  }
  if ((m = u.match(/\b(?:para\s+)?(?:el\s+)?(?:(?:proximo|siguiente)\s+mes|mes\s+que\s+viene)\b/))) {
    u.consumeMatch(m);
    return { kind: 'ambiguous', question: '¿Qué día del próximo mes? Por ejemplo: "el 5" o "05/12".', options: [] };
  }
  if ((m = u.match(new RegExp(`\\b(?:en|para)\\s+${MONTH}\\b`)))) {
    u.consumeMatch(m);
    return { kind: 'ambiguous', question: `¿Qué día de ${m[1]}?`, options: [] };
  }

  return null;
}

/* ───────────── Rangos para consultas ───────────── */

export interface DateRange {
  from?: DateKey;
  to?: DateKey;
  label: string;
}

export function extractRange(u: Utterance, today: DateKey): DateRange | null {
  let m: RegExpExecArray | null;
  if ((m = u.match(/\b(?:para\s+|de\s+)?(?:esta|la)\s+semana\b(?!\s+que\s+viene)/)) && !/(proxima|siguiente|otra)\s*$/.test(u.masked.slice(0, m.index))) {
    u.consumeMatch(m);
    return { from: today, to: endOfWeek(today), label: 'esta semana' };
  }
  if ((m = u.match(/\b(?:para\s+)?(?:la\s+)?(?:(?:proxima|siguiente|otra)\s+semana|semana\s+que\s+viene)\b/))) {
    u.consumeMatch(m);
    const monday = addDays(startOfWeek(today), 7);
    return { from: monday, to: addDays(monday, 6), label: 'la próxima semana' };
  }
  if ((m = u.match(/\b(?:para\s+|de\s+)?(?:este|el)\s+mes\b(?!\s+que\s+viene)/)) && !/(proximo|siguiente)\s*$/.test(u.masked.slice(0, m.index))) {
    u.consumeMatch(m);
    return { from: startOfMonth(today), to: endOfMonth(today), label: 'este mes' };
  }
  if ((m = u.match(/\b(?:para\s+)?(?:el\s+)?(?:(?:proximo|siguiente)\s+mes|mes\s+que\s+viene)\b/))) {
    u.consumeMatch(m);
    const first = addMonths(startOfMonth(today), 1);
    return { from: first, to: endOfMonth(first), label: 'el próximo mes' };
  }
  if ((m = u.match(/\b(?:este\s+|el\s+)?fin\s+de\s+semana\b/))) {
    u.consumeMatch(m);
    const sat = nextWeekday(today, 6, true);
    return { from: weekday(today) === 0 ? today : sat, to: weekday(today) === 0 ? today : addDays(sat, 1), label: 'el fin de semana' };
  }
  const single = extractDate(u, today);
  if (single?.kind === 'date') {
    const label =
      single.date === today ? 'hoy' : single.date === addDays(today, 1) ? 'mañana' : `el ${formatDate(single.date)}`;
    return { from: single.date, to: single.date, label };
  }
  return null;
}
