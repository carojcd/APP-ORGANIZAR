import { isDateKey, isTimeKey } from '@/lib/dates';
import { ValidationError } from '@/lib/errors';
import { isKnownCategory } from './categories';
import type { ItemDraft, ItemPatch, ItemStatus, MoneyDirection, Priority } from './types';

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const STATUSES: ItemStatus[] = ['pending', 'in_progress', 'done'];
const DIRECTIONS: MoneyDirection[] = ['pay', 'collect'];

export const TITLE_MAX = 140;
export const DESCRIPTION_MAX = 2000;
export const AMOUNT_MAX = 100_000_000_000;

/** Devuelve la lista de problemas (vacía si todo está bien). */
export function validateItemFields(data: ItemPatch, { requireTitle }: { requireTitle: boolean }): string[] {
  const issues: string[] = [];
  if (requireTitle || data.title !== undefined) {
    const title = (data.title ?? '').trim();
    if (!title) issues.push('El título es obligatorio.');
    else if (title.length > TITLE_MAX) issues.push(`El título no puede superar ${TITLE_MAX} caracteres.`);
  }
  if (data.description !== undefined && data.description.length > DESCRIPTION_MAX) {
    issues.push(`La descripción no puede superar ${DESCRIPTION_MAX} caracteres.`);
  }
  if (data.categoryId !== undefined && !isKnownCategory(data.categoryId)) issues.push('Categoría no válida.');
  if (data.date != null && !isDateKey(data.date)) issues.push('La fecha no es válida.');
  if (data.dueDate != null && !isDateKey(data.dueDate)) issues.push('La fecha de vencimiento no es válida.');
  if (data.time != null && !isTimeKey(data.time)) issues.push('La hora no es válida.');
  if (data.time != null && data.date == null && data.dueDate == null && requireTitle) {
    issues.push('Una hora necesita una fecha.');
  }
  if (data.priority !== undefined && !PRIORITIES.includes(data.priority)) issues.push('Prioridad no válida.');
  if (data.status !== undefined && !STATUSES.includes(data.status)) issues.push('Estado no válido.');
  if (data.direction != null && !DIRECTIONS.includes(data.direction)) issues.push('Tipo de movimiento no válido.');
  if (data.amount != null) {
    if (!Number.isFinite(data.amount) || data.amount < 0) issues.push('El valor debe ser un número positivo.');
    else if (data.amount > AMOUNT_MAX) issues.push('El valor es demasiado grande.');
  }
  if (data.reminder != null) {
    const m = data.reminder.minutesBefore;
    if (!Number.isInteger(m) || m < 0 || m > 60 * 24 * 30) issues.push('El recordatorio no es válido.');
  }
  return issues;
}

export function assertValidDraft(draft: ItemDraft): void {
  const issues = validateItemFields(draft, { requireTitle: true });
  if (issues.length) throw new ValidationError(issues);
}

export function assertValidPatch(patch: ItemPatch): void {
  const issues = validateItemFields(patch, { requireTitle: false });
  if (issues.length) throw new ValidationError(issues);
}
