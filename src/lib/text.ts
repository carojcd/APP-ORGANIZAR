/** Normaliza texto en español para comparar: minúsculas, sin tildes ni signos. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:"“”'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'con', 'para', 'por',
  'en', 'y', 'o', 'mi', 'mis', 'que', 'se', 'lo', 'le', 'su', 'sus', 'tengo', 'debo',
]);

export function keywords(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Similitud simple por palabras clave compartidas (0 a 1). */
export function similarity(a: string, b: string): number {
  const ka = new Set(keywords(a));
  const kb = new Set(keywords(b));
  if (ka.size === 0 || kb.size === 0) return 0;
  let shared = 0;
  for (const w of ka) if (kb.has(w)) shared++;
  return shared / Math.min(ka.size, kb.size);
}

export function capitalizeFirst(text: string): string {
  const t = text.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
