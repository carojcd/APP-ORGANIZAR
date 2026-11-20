/**
 * Encuentra el registro al que se refiere el usuario ("la reunión de mañana").
 * Si hay varios candidatos parecidos NO elige al azar: devuelve 'ambiguous'.
 */
import { effectiveDate } from '@/domain/items';
import type { Item } from '@/domain/types';
import { similarity } from '@/lib/text';
import type { ItemTarget } from '../ai/types';

export type TargetResolution =
  | { status: 'found'; item: Item }
  | { status: 'ambiguous'; candidates: Item[] }
  | { status: 'none' };

export function resolveTarget(target: ItemTarget, items: Item[]): TargetResolution {
  if (target.id) {
    const item = items.find((i) => i.id === target.id);
    return item ? { status: 'found', item } : { status: 'none' };
  }
  let pool = items;
  if (target.date) pool = pool.filter((i) => effectiveDate(i) === target.date);
  if (target.categoryId) pool = pool.filter((i) => i.categoryId === target.categoryId);

  if (!target.text) {
    if (pool.length === 1) return { status: 'found', item: pool[0] };
    if (pool.length > 1) return { status: 'ambiguous', candidates: pool.slice(0, 4) };
    return { status: 'none' };
  }

  const scored = pool
    .map((item) => ({ item, score: similarity(target.text!, `${item.title} ${item.description}`) }))
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { status: 'none' };
  if (scored.length === 1 || scored[0].score - scored[1].score >= 0.25) return { status: 'found', item: scored[0].item };
  const top = scored.filter((s) => scored[0].score - s.score < 0.25).map((s) => s.item);
  return { status: 'ambiguous', candidates: top.slice(0, 4) };
}
