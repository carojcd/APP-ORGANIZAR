/**
 * Validación en tiempo de ejecución de la respuesta de un proveedor de IA.
 * Indispensable para Gemini: nunca se confía en el JSON recibido sin revisarlo.
 */
import { isKnownCategory } from '@/domain/categories';
import { isDateKey, isTimeKey } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import type { AssistantAction, Interpretation } from './types';

const ACTION_TYPES = ['create_item', 'update_item', 'complete_item', 'delete_item', 'query_items', 'clarify', 'reply'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkDates(o: Obj, path: string, issues: string[]) {
  for (const k of ['date', 'dueDate', 'from', 'to']) {
    if (o[k] != null && !isDateKey(o[k])) issues.push(`${path}.${k} no es AAAA-MM-DD válido`);
  }
  if (o.time != null && !isTimeKey(o.time)) issues.push(`${path}.time no es HH:mm válido`);
  if (o.categoryId != null && (typeof o.categoryId !== 'string' || !isKnownCategory(o.categoryId))) {
    issues.push(`${path}.categoryId desconocida`);
  }
  if (o.amount != null && (typeof o.amount !== 'number' || o.amount < 0)) issues.push(`${path}.amount inválido`);
}

export function validateAction(action: unknown, path = 'action'): string[] {
  const issues: string[] = [];
  if (!isObj(action) || typeof action.type !== 'string' || !ACTION_TYPES.includes(action.type)) {
    return [`${path}.type inválido`];
  }
  switch (action.type) {
    case 'create_item': {
      const item = action.item;
      if (!isObj(item)) return [`${path}.item requerido`];
      if (typeof item.title !== 'string' || !item.title.trim()) issues.push(`${path}.item.title requerido`);
      if (typeof item.categoryId !== 'string') issues.push(`${path}.item.categoryId requerido`);
      checkDates(item, `${path}.item`, issues);
      break;
    }
    case 'update_item':
      if (!isObj(action.target)) issues.push(`${path}.target requerido`);
      else checkDates(action.target, `${path}.target`, issues);
      if (!isObj(action.changes)) issues.push(`${path}.changes requerido`);
      else checkDates(action.changes, `${path}.changes`, issues);
      break;
    case 'complete_item':
    case 'delete_item':
      if (!isObj(action.target)) issues.push(`${path}.target requerido`);
      else checkDates(action.target, `${path}.target`, issues);
      break;
    case 'query_items':
      if (!isObj(action.query)) issues.push(`${path}.query requerido`);
      else checkDates(action.query, `${path}.query`, issues);
      break;
    case 'clarify':
      if (typeof action.question !== 'string') issues.push(`${path}.question requerido`);
      if (action.pending != null && !isObj(action.pending)) issues.push(`${path}.pending inválido`);
      break;
    case 'reply':
      if (typeof action.text !== 'string') issues.push(`${path}.text requerido`);
      break;
  }
  return issues;
}

/** Valida y tipa una interpretación. Lanza AppError si no cumple el contrato. */
export function parseInterpretation(raw: unknown): Interpretation {
  if (!isObj(raw) || !Array.isArray(raw.actions)) {
    throw new AppError('Respuesta de IA sin "actions"', 'No entendí la respuesta del asistente.');
  }
  const issues = raw.actions.flatMap((a, i) => validateAction(a, `actions[${i}]`));
  if (issues.length) {
    throw new AppError(`Respuesta de IA inválida: ${issues.join('; ')}`, 'La respuesta del asistente no era válida.');
  }
  return { actions: raw.actions as AssistantAction[] };
}
