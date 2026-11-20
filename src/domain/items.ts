/**
 * Reglas de negocio puras sobre registros: construcción con valores por
 * defecto, filtros, orden y detección de duplicados. Las usan todos los
 * repositorios (local o remoto) para comportarse igual.
 */
import { createId } from '@/lib/id';
import { isBetween } from '@/lib/dates';
import { keywords, normalize } from '@/lib/text';
import type { DateKey, Item, ItemDraft, ItemFilter } from './types';

export function buildItem(draft: ItemDraft, now: Date = new Date()): Item {
  const iso = now.toISOString();
  const status = draft.status ?? 'pending';
  return {
    id: createId(),
    title: draft.title.trim(),
    description: (draft.description ?? '').trim(),
    categoryId: draft.categoryId,
    date: draft.date ?? null,
    time: draft.time ?? null,
    priority: draft.priority ?? 'medium',
    status,
    reminder: draft.reminder ?? null,
    amount: draft.amount ?? null,
    direction: draft.direction ?? (draft.amount != null && draft.categoryId === 'finance' ? 'pay' : null),
    dueDate: draft.dueDate ?? null,
    createdAt: iso,
    updatedAt: iso,
    completedAt: status === 'done' ? iso : null,
    source: draft.source ?? 'manual',
  };
}

/** Fecha que manda para agenda y orden: la del evento o, si no hay, el vencimiento. */
export function effectiveDate(item: Pick<Item, 'date' | 'dueDate'>): DateKey | null {
  return item.date ?? item.dueDate ?? null;
}

export function matchesFilter(item: Item, filter: ItemFilter = {}): boolean {
  if (filter.categoryIds?.length && !filter.categoryIds.includes(item.categoryId)) return false;
  if (filter.statuses?.length && !filter.statuses.includes(item.status)) return false;
  if (filter.onlyWithAmount && item.amount == null) return false;
  if (filter.from || filter.to) {
    const d = effectiveDate(item);
    if (!d || !isBetween(d, filter.from, filter.to)) return false;
  }
  if (filter.text) {
    const q = normalize(filter.text);
    if (!normalize(`${item.title} ${item.description}`).includes(q)) return false;
  }
  return true;
}

/** Orden cronológico: con fecha primero (fecha, hora), luego sin fecha por creación. */
export function compareItems(a: Item, b: Item): number {
  const da = effectiveDate(a);
  const db = effectiveDate(b);
  if (da && db && da !== db) return da < db ? -1 : 1;
  if (da && !db) return -1;
  if (!da && db) return 1;
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  return a.createdAt < b.createdAt ? -1 : 1;
}

function sameKeywords(a: string, b: string): boolean {
  const ka = [...new Set(keywords(a))].sort().join(' ');
  const kb = [...new Set(keywords(b))].sort().join(' ');
  return ka !== '' && ka === kb;
}

/**
 * Un registro es duplicado si sigue abierto, tiene la misma categoría, el mismo
 * título (por palabras clave) y la misma fecha/hora efectiva.
 */
export function isDuplicateOf(existing: Item, draft: ItemDraft): boolean {
  if (existing.status === 'done') return false;
  if (existing.categoryId !== draft.categoryId) return false;
  if (!sameKeywords(existing.title, draft.title)) return false;
  const d1 = effectiveDate(existing);
  const d2 = draft.date ?? draft.dueDate ?? null;
  if (d1 !== d2) return false;
  if (existing.time && draft.time && existing.time !== draft.time) return false;
  return true;
}
