/**
 * Extrae valores en pesos colombianos:
 * "$350.000", "350.000 pesos", "350 mil", "1,5 millones", "un millón", "$1'200.000", "50k".
 * Un número suelto sin "$" ni unidad no se toma como dinero (podría ser una hora o un día).
 */
import type { Utterance } from './utterance';

function parseColombianNumber(raw: string, multiplier: number): number | null {
  // El apóstrofo marca millones en Colombia: 1'200.000.
  let s = raw.replace(/\s/g, '').replace(/'/g, '.');
  if (multiplier > 1) {
    // "1,5 millones" / "1.5 millones": separador decimal.
    s = s.replace(',', '.');
    if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');
  } else {
    // "350.000" / "350,000": separadores de miles.
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
    else s = s.replace(',', '.');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * multiplier);
}

function unitMultiplier(unit: string | undefined): number {
  if (!unit) return 1;
  if (unit.startsWith('mill')) return 1_000_000;
  if (unit === 'mil' || unit === 'k') return 1_000;
  return 1;
}

export function extractAmount(u: Utterance): number | null {
  let m: RegExpExecArray | null;

  // Palabras: "un millón", "medio millón", "dos millones".
  if ((m = u.match(/\b(?:por\s+|de\s+)?(un|medio|dos|tres|cuatro|cinco)\s+(millon(?:es)?)(?:\s+de\s+pesos)?\b/))) {
    const base = { un: 1, medio: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5 }[m[1]] ?? 1;
    u.consumeMatch(m);
    return Math.round(base * 1_000_000);
  }

  // "$ 350.000", "$350 mil", "$1,5 millones".
  if ((m = u.match(/(?:\b(?:por|de|valor|cuesta|son)\s+)?\$\s*(\d[\d.,']*)\s*(mil(?:lones|lon)?|millones|millon|k)?\b/))) {
    const n = parseColombianNumber(m[1], unitMultiplier(m[2]));
    if (n != null) {
      u.consumeMatch(m);
      return n;
    }
  }

  // "350.000 pesos", "350 mil", "1,5 millones", "50k".
  if ((m = u.match(/(?:\b(?:por|de|valor|cuesta|son)\s+)?\b(\d[\d.,']*)\s*(mil(?:\s+pesos)?|millones|millon|k|pesos|cop)\b(?:\s+(?:pesos|cop)\b)?/))) {
    const unit = m[2].startsWith('mil ') ? 'mil' : m[2];
    const n = parseColombianNumber(m[1], unitMultiplier(unit));
    if (n != null && n > 0) {
      u.consumeMatch(m);
      return n;
    }
  }
  return null;
}
