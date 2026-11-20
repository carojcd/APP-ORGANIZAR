/**
 * Extrae la hora de una frase en español.
 * Si la hora es de 1 a 12 sin indicación de a. m./p. m., NO la adivina:
 * devuelve `needsMeridiem` para que el asistente pregunte.
 */
import type { TimeKey } from '@/domain/types';
import { NUM, parseNumber } from './numbers';
import type { Utterance } from './utterance';

export type TimeResult =
  | { kind: 'time'; time: TimeKey }
  | { kind: 'needsMeridiem'; hour: number; minute: number }
  | null;

const pad = (n: number) => String(n).padStart(2, '0');
export const toTimeKey = (h: number, m: number): TimeKey => `${pad(h)}:${pad(m)}`;

const LEAD = '(?:(?:a|desde|hasta|para|sobre)\\s+(?:eso\\s+de\\s+)?)?(?:las?\\s+)?';
const FRACTION = '(\\s+y\\s+media|\\s+y\\s+cuarto|\\s+menos\\s+cuarto)?';
const MERIDIEM =
  '(?:\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?)(?![a-z])|\\s+(?:de|en|por)\\s+la\\s+(manana|tarde|noche|madrugada)\\b|\\s+(?:del\\s+)?(mediodia)\\b)';

export type Meridiem = 'am' | 'pm' | 'night' | 'noon';

export function applyMeridiem(hour: number, minute: number, meridiem: Meridiem): { h: number; m: number } | null {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  if (hour > 12) return { h: hour, m: minute }; // ya está en 24 h
  switch (meridiem) {
    case 'am':
      return { h: hour === 12 ? 0 : hour, m: minute };
    case 'pm':
      return { h: hour === 12 ? 12 : hour + 12, m: minute };
    case 'night':
      // "12 de la noche" = medianoche; "1 de la noche" ≈ madrugada se trata como 1 a. m.
      if (hour === 12) return { h: 0, m: minute };
      return { h: hour < 4 ? hour : hour + 12, m: minute };
    case 'noon':
      return { h: 12, m: minute };
  }
}

export function meridiemFromWord(word: string | undefined): Meridiem | null {
  if (!word) return null;
  const w = word.replace(/[.\s]/g, '');
  if (w === 'am' || w === 'manana' || w === 'madrugada') return 'am';
  if (w === 'pm' || w === 'tarde') return 'pm';
  if (w === 'noche') return 'night';
  if (w === 'mediodia') return 'noon';
  return null;
}

function applyFraction(hour: number, fraction: string | undefined): { hour: number; minute: number } {
  if (!fraction) return { hour, minute: 0 };
  if (fraction.includes('media')) return { hour, minute: 30 };
  if (fraction.includes('menos')) return { hour: hour === 1 ? 12 : hour - 1, minute: 45 };
  return { hour, minute: 15 };
}

/** Pista de periodo del día en otra parte de la frase ("en la tarde", "esta noche"). */
function periodHint(u: Utterance): Meridiem | null {
  const m = u.match(/\b(?:(?:en|por)\s+la|esta)\s+(manana|tarde|noche)\b/);
  if (!m) return null;
  // "en la tarde" se consume; "esta tarde" se deja para que el parser de fechas lo lea como "hoy".
  if (!m[0].startsWith('esta')) u.consumeMatch(m);
  return meridiemFromWord(m[1]);
}

export function extractTime(u: Utterance): TimeResult {
  // 1) Mediodía / medianoche sueltos.
  const special = u.match(/\b(?:a\s+(?:las\s+12\s+del?\s+)?)?(mediodia|medianoche)\b/);
  if (special && !u.has(new RegExp(`\\b${NUM}\\s+del?\\s+mediodia`))) {
    u.consumeMatch(special);
    return { kind: 'time', time: special[1] === 'mediodia' ? '12:00' : '00:00' };
  }

  // 2) Hora con indicador explícito: "9 am", "3:30 p. m.", "9 de la mañana", "3 y media de la tarde".
  const explicit = u.match(new RegExp(`\\b${LEAD}(${NUM})(?::([0-5]\\d))?${FRACTION}${MERIDIEM}`));
  if (explicit) {
    const raw = parseNumber(explicit[1]);
    if (raw != null && raw <= 23) {
      const base = explicit[2] ? { hour: raw, minute: Number(explicit[2]) } : applyFraction(raw, explicit[3]);
      const meridiem = meridiemFromWord(explicit[4] ?? explicit[5] ?? explicit[6]);
      const r = meridiem ? applyMeridiem(base.hour, base.minute, meridiem) : null;
      if (r) {
        u.consumeMatch(explicit);
        return { kind: 'time', time: toTimeKey(r.h, r.m) };
      }
    }
  }

  // 3) Hora introducida por "a las", "para las"… sin a. m./p. m.
  const lead = u.match(
    // Los números en palabras exigen "la/las" ("a las nueve", "a la una") para no confundir "para un cliente".
    new RegExp(`\\b(?:a|desde|hasta|para|sobre|tipo)\\s+(?:eso\\s+de\\s+)?(?:las?\\s+(${NUM})|(\\d{1,2}))(?::([0-5]\\d))?${FRACTION}(?![\\d:/])`),
  );
  // 4) Formato 24 h suelto: "15:30".
  const clock = lead ? null : u.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const m = lead ?? clock;
  if (!m) return null;

  const hourToken = lead ? (lead[1] ?? lead[2]) : m[1];
  const minuteToken = lead ? lead[3] : m[2];
  const raw = parseNumber(hourToken);
  if (raw == null || raw > 23) return null;
  const base = minuteToken ? { hour: raw, minute: Number(minuteToken) } : applyFraction(raw, lead ? lead[4] : undefined);
  u.consumeMatch(m);

  if (base.hour === 0 || base.hour > 12) return { kind: 'time', time: toTimeKey(base.hour, base.minute) };

  const hint = periodHint(u);
  if (hint) {
    const r = applyMeridiem(base.hour, base.minute, hint);
    if (r) return { kind: 'time', time: toTimeKey(r.h, r.m) };
  }
  return { kind: 'needsMeridiem', hour: base.hour, minute: base.minute };
}

/** Interpreta la respuesta a "¿a. m. o p. m.?". */
export function parseMeridiemReply(text: string): Meridiem | null {
  const t = text.trim();
  if (/(?:^|\s|\d)(a\.?\s?m\.?|am|manana|madrugada)(?![a-z])/.test(t)) return 'am';
  if (/(?:^|\s|\d)(p\.?\s?m\.?|pm|tarde)(?![a-z])/.test(t)) return 'pm';
  if (/\bnoche\b/.test(t)) return 'night';
  if (/\bmediodia\b/.test(t)) return 'noon';
  return null;
}
