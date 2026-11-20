/**
 * Construye un título limpio con lo que queda de la frase tras extraer
 * fecha, hora, monto y prioridad. Conserva mayúsculas originales.
 */
import { capitalizeFirst } from '@/lib/text';
import { fold } from './utterance';

const LEADING = [
  /^(?:y\s+)?(?:oye\s+|hola\s+)?(?:por\s+favor\s+)?/,
  /^(?:recuerdame|recordarme|recuerdeme|recuerda(?:me)?|avisame|no\s+me\s+dejes\s+olvidar|que\s+no\s+se\s+me\s+olvide|no\s+olvides|no\s+olvidar|anota(?:r|me)?|apunta(?:r)?|agrega(?:r)?|anade|anadir|crea(?:r)?|registra(?:r)?|programa(?:r)?|agenda(?:r)?|pon(?:me)?|guarda(?:r)?)\s+(?:que\s+)?/,
  /^(?:tengo\s+que|tenemos\s+que|debo\s+de|debo|hay\s+que|necesito|quiero|voy\s+a|me\s+toca|tengo|tenemos|hay)\s+(?:que\s+)?/,
  /^(?:un|una|unos|unas|el|la|los|las)\s+/,
  /^(?:nuevo|nueva)\s+/,
];

const TRAILING = /\s+(?:por|de|del|para|a|al|el|la|los|las|en|con|y|que|un|una|desde|hasta|antes|este|esta)$/;

export function buildTitle(remainder: string): string {
  let text = remainder.replace(/^[\s,.-]+|[\s,.-]+$/g, '');
  // Quita conectores iniciales repetidamente (comparando sobre el texto plegado).
  for (let pass = 0; pass < 3; pass++) {
    for (const re of LEADING) {
      const m = re.exec(fold(text));
      if (m && m[0].length > 0) text = text.slice(m[0].length);
    }
  }
  // Quita preposiciones colgantes al final ("pago de servicios por").
  let prev = '';
  while (prev !== text) {
    prev = text;
    const m = TRAILING.exec(fold(text));
    if (m) text = text.slice(0, m.index);
    text = text.replace(/[\s,.-]+$/g, '');
  }
  text = text.replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
  return capitalizeFirst(text);
}

/** Limpia el texto que describe un registro existente ("la entrega de FLM" → "entrega de FLM"). */
export function cleanTarget(remainder: string): string {
  let text = remainder.trim();
  for (let pass = 0; pass < 2; pass++) {
    const m = /^(?:la|el|los|las|lo|un|una|de|del|que|tarea|registro|evento|pendiente)\s+/.exec(fold(text));
    if (m) text = text.slice(m[0].length);
  }
  let prev = '';
  while (prev !== text) {
    prev = text;
    const m = TRAILING.exec(fold(text));
    if (m) text = text.slice(0, m.index);
    text = text.replace(/[\s,.-]+$/g, '');
  }
  return text.trim();
}
