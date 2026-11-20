/**
 * Clasificación por palabras clave para el modo demostración.
 * Usa el registro de categorías, así que una categoría nueva con
 * `keywords` queda clasificable sin tocar este archivo.
 */
import { CATEGORIES, DEFAULT_CATEGORY_ID } from '@/domain/categories';
import type { CategoryId, MoneyDirection, Priority } from '@/domain/types';
import { fold } from './utterance';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function classify(text: string, hasAmount: boolean): CategoryId {
  const t = fold(text);
  const scores = new Map<CategoryId, number>();
  for (const cat of CATEGORIES) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (new RegExp(`\\b${escape(kw)}\\b`).test(t)) score += kw.includes(' ') ? 2 : 1;
    }
    // Mencionar la categoría por su nombre pesa más.
    if (new RegExp(`\\b${escape(fold(cat.label))}\\b`).test(t)) score += 3;
    scores.set(cat.id, score);
  }
  if (hasAmount) scores.set('finance', (scores.get('finance') ?? 0) + 2);
  // "cliente" + entrega/diseño sin monto → freelance antes que finanzas.
  let best: CategoryId = DEFAULT_CATEGORY_ID;
  let bestScore = 0;
  for (const [id, score] of scores) {
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

export function detectPriority(text: string): Priority | undefined {
  const t = fold(text);
  if (/\b(urgente|urgentemente|importante|prioridad\s+alta|alta\s+prioridad|sin\s+falta|critico)\b/.test(t)) return 'high';
  if (/\b(sin\s+prisa|cuando\s+pueda|baja\s+prioridad|prioridad\s+baja|no\s+es\s+urgente)\b/.test(t)) return 'low';
  return undefined;
}

export function detectDirection(text: string): MoneyDirection {
  const t = fold(text);
  return /\b(cobrar|cobrarle|cobro|me\s+deben|me\s+debe|me\s+pagan|me\s+paga|por\s+cobrar|recibir\s+pago)\b/.test(t)
    ? 'collect'
    : 'pay';
}
