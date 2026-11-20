/** Números escritos en español (plegados, sin tildes). */
export const NUMBER_WORDS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, 'treinta y uno': 31, 'treinta y un': 31,
};

const words = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).map((w) => w.replace(/ /g, '\\s+'));

/** Patrón (sin grupo de captura propio) para un número de 1-2 cifras o en palabras. */
export const NUM = `(?:\\d{1,2}|${words.join('|')})`;

export function parseNumber(token: string): number | null {
  const t = token.trim().replace(/\s+/g, ' ');
  if (/^\d+$/.test(t)) return Number(t);
  return NUMBER_WORDS[t] ?? null;
}

export const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};
export const WEEKDAY = '(lunes|martes|miercoles|jueves|viernes|sabado|domingo)';

export const MONTH_INDEX: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
export const MONTH = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)';
