/**
 * Ejecuta las acciones propuestas por el proveedor de IA contra el
 * repositorio y redacta la respuesta a partir del RESULTADO REAL.
 * Si una operación falla, la respuesta lo dice; nunca confirma algo que no ocurrió.
 */
import { getCategory, isKnownCategory, DEFAULT_CATEGORY_ID } from '@/domain/categories';
import { effectiveDate } from '@/domain/items';
import type { ActionOutcome, DateKey, Item, ItemDraft, ItemPatch, QuickReply } from '@/domain/types';
import { addDays } from '@/lib/dates';
import { formatCOP, formatDate, formatTime, formatRelativeDay } from '@/lib/format';
import { toUserMessage } from '@/lib/errors';
import type { ItemRepository } from '../storage/types';
import type { ActionItemChanges, ActionItemDraft, AssistantAction, ItemQuery, PendingIntent } from '../ai/types';
import { resolveTarget } from './targetResolver';

export interface ExecutionResult {
  text: string;
  outcomes: ActionOutcome[];
  quickReplies?: QuickReply[];
  pending: PendingIntent | null;
}

interface Deps {
  items: ItemRepository;
  today: DateKey;
}

function describeWhen(date: DateKey | null, time: string | null, today: DateKey): string {
  if (!date) return time ? `a las ${formatTime(time)}` : 'sin fecha';
  const rel = formatRelativeDay(date, today);
  const isWord = ['Hoy', 'Mañana', 'Ayer'].includes(rel);
  const dayPart = isWord ? `${rel.toLowerCase()}, ${formatDate(date)}` : `el ${formatDate(date)}`;
  return time ? `${dayPart}, a las ${formatTime(time)}` : dayPart;
}

function draftFromAction(item: ActionItemDraft): ItemDraft {
  const categoryId = isKnownCategory(item.categoryId) ? item.categoryId : DEFAULT_CATEGORY_ID;
  return {
    title: item.title,
    description: item.description ?? '',
    categoryId,
    date: item.date ?? null,
    time: item.time ?? null,
    priority: item.priority ?? 'medium',
    amount: item.amount ?? null,
    direction: item.direction ?? (categoryId === 'finance' && item.amount != null ? 'pay' : null),
    dueDate: item.dueDate ?? null,
    reminder:
      item.reminderMinutesBefore != null ? { enabled: true, minutesBefore: item.reminderMinutesBefore } : null,
    source: 'chat',
  };
}

function patchFromChanges(changes: ActionItemChanges, current: Item): ItemPatch {
  const patch: ItemPatch = {};
  if (changes.title !== undefined) patch.title = changes.title;
  if (changes.description !== undefined) patch.description = changes.description;
  if (changes.categoryId !== undefined && isKnownCategory(changes.categoryId)) patch.categoryId = changes.categoryId;
  if (changes.date !== undefined) {
    patch.date = changes.date;
    // Si el vencimiento coincidía con la fecha, se mueve con ella.
    if (current.dueDate && current.dueDate === current.date) patch.dueDate = changes.date;
    if (!current.date && current.dueDate) {
      patch.date = null;
      patch.dueDate = changes.date;
    }
  }
  if (changes.dueDate !== undefined) patch.dueDate = changes.dueDate;
  if (changes.time !== undefined) patch.time = changes.time;
  if (changes.priority !== undefined) patch.priority = changes.priority;
  if (changes.amount !== undefined) patch.amount = changes.amount;
  if (changes.direction !== undefined) patch.direction = changes.direction;
  if (changes.status !== undefined) patch.status = changes.status;
  if (changes.reminderMinutesBefore !== undefined) {
    patch.reminder = changes.reminderMinutesBefore == null ? null : { enabled: true, minutesBefore: changes.reminderMinutesBefore };
  }
  return patch;
}

function candidateLabel(item: Item, today: DateKey): string {
  const when = effectiveDate(item);
  return when ? `${item.title} · ${formatRelativeDay(when, today)}` : item.title;
}

export class ActionExecutor {
  constructor(private readonly deps: Deps) {}

  async execute(actions: AssistantAction[]): Promise<ExecutionResult> {
    const texts: string[] = [];
    const outcomes: ActionOutcome[] = [];
    let quickReplies: QuickReply[] | undefined;
    let pending: PendingIntent | null = null;

    for (const action of actions) {
      try {
        const r = await this.executeOne(action);
        texts.push(r.text);
        outcomes.push(...r.outcomes);
        if (r.quickReplies) quickReplies = r.quickReplies;
        if (r.pending) pending = r.pending;
      } catch (error) {
        texts.push(`No pude completar esa acción: ${toUserMessage(error)} No se guardó ningún cambio.`);
        outcomes.push({ kind: 'error', itemIds: [] });
      }
    }
    return { text: texts.join('\n\n'), outcomes, quickReplies, pending };
  }

  private async executeOne(action: AssistantAction): Promise<ExecutionResult> {
    const { items, today } = this.deps;
    switch (action.type) {
      case 'reply':
        return { text: action.text, outcomes: [], pending: null };

      case 'clarify':
        return { text: action.question, outcomes: [], quickReplies: action.options, pending: action.pending ?? null };

      case 'create_item': {
        const draft = draftFromAction(action.item);
        const duplicate = await items.findDuplicate(draft);
        if (duplicate) {
          return {
            text: `${endSentence(`Ya tienes «${duplicate.title}» ${describeWhen(effectiveDate(duplicate), duplicate.time, today)}`)} No lo dupliqué.`,
            outcomes: [{ kind: 'duplicate', itemIds: [duplicate.id], snapshots: [duplicate] }],
            pending: null,
          };
        }
        const created = await items.create(draft);
        const cat = getCategory(created.categoryId).label;
        const date = effectiveDate(created);
        let text = `Listo, guardé «${created.title}» en ${cat}`;
        if (date) text += `, ${describeWhen(date, created.time, today)}`;
        if (created.amount != null) text += `, por ${formatCOP(created.amount)}`;
        text = endSentence(text);
        if (created.reminder?.enabled) {
          text += created.reminder.minutesBefore > 0
            ? ` Programé un recordatorio ${formatMinutes(created.reminder.minutesBefore)} antes.`
            : created.time
              ? ' Programé un recordatorio para esa hora.'
              : ' Programé un recordatorio para las 8:00 a. m. de ese día.';
        }
        if (!effectiveDate(created)) text += ' Quedó sin fecha; si quieres, dime cuándo es.';
        return { text, outcomes: [{ kind: 'created', itemIds: [created.id], snapshots: [created] }], pending: null };
      }

      case 'complete_item':
      case 'delete_item':
      case 'update_item': {
        const pool = await items.list(
          action.type === 'delete_item' ? undefined : { statuses: action.type === 'complete_item' ? ['pending', 'in_progress'] : undefined },
        );
        const res = resolveTarget(action.target, pool);
        if (res.status === 'none') {
          const what = action.target.text ? `«${action.target.text}»` : 'ese registro';
          const extra = action.type === 'complete_item' ? ' entre tus pendientes' : '';
          return { text: `No encontré ${what}${extra}. No hice ningún cambio.`, outcomes: [{ kind: 'not_found', itemIds: [] }], pending: null };
        }
        if (res.status === 'ambiguous') {
          const options = res.candidates.map((c, i) => ({ label: `${i + 1}. ${candidateLabel(c, today)}`, value: String(i + 1) }));
          return {
            text: `Encontré varios registros parecidos. ¿Cuál?\n${options.map((o) => o.label).join('\n')}`,
            outcomes: [],
            quickReplies: [...options, { label: 'Cancelar', value: 'Cancelar' }],
            pending: {
              action,
              missing: 'target',
              candidates: res.candidates.map((c) => ({ id: c.id, title: c.title })),
            },
          };
        }
        const item = res.item;
        if (action.type === 'complete_item') {
          if (item.status === 'done') {
            return { text: `«${item.title}» ya estaba completada.`, outcomes: [], pending: null };
          }
          const updated = await items.update(item.id, { status: 'done' });
          return {
            text: `Hecho. Marqué «${updated.title}» como completada.`,
            outcomes: [{ kind: 'completed', itemIds: [updated.id], snapshots: [updated] }],
            pending: null,
          };
        }
        if (action.type === 'delete_item') {
          await items.remove(item.id);
          return { text: `Eliminé «${item.title}».`, outcomes: [{ kind: 'deleted', itemIds: [item.id], snapshots: [item] }], pending: null };
        }
        const patch = patchFromChanges(action.changes, item);
        if (Object.keys(patch).length === 0) {
          return { text: 'No identifiqué qué cambiar. No hice ningún cambio.', outcomes: [], pending: null };
        }
        const updated = await items.update(item.id, patch);
        let text = `Actualicé «${updated.title}»: ahora es ${describeWhen(effectiveDate(updated), updated.time, today)}`;
        if (patch.amount != null) text += `, por ${formatCOP(patch.amount)}`;
        return { text: endSentence(text), outcomes: [{ kind: 'updated', itemIds: [updated.id], snapshots: [updated] }], pending: null };
      }

      case 'query_items':
        return this.runQuery(action.query);
    }
  }

  private async runQuery(query: ItemQuery): Promise<ExecutionResult> {
    const { items, today } = this.deps;
    let results = await items.list({
      from: query.from,
      to: query.to,
      categoryIds: query.categoryIds,
      statuses: query.statuses,
      onlyWithAmount: query.onlyWithAmount,
    });
    if (query.direction) results = results.filter((i) => i.direction == null || i.direction === query.direction);

    const isFinance = query.categoryIds?.length === 1 && query.categoryIds[0] === 'finance';
    const done = query.statuses?.length === 1 && query.statuses[0] === 'done';
    const noun = isFinance
      ? query.direction === 'collect' ? 'cobros' : 'pagos'
      : query.categoryIds?.length === 1
        ? `registros de ${getCategory(query.categoryIds[0]).label}`
        : done ? 'registros' : 'pendientes';
    const adjective = done ? (isFinance ? ' completados' : ' completados') : isFinance ? ' pendientes' : query.categoryIds?.length ? ' pendientes' : '';
    const period = query.label ? ` ${query.label === 'vencidos' ? 'vencidos' : query.label}` : '';

    let text: string;
    if (results.length === 0) {
      text = `No tienes ${noun}${query.label === 'vencidos' ? '' : adjective}${period}. ✨`;
    } else {
      const count = results.length === 1 ? `1 ${singular(noun)}` : `${results.length} ${noun}`;
      text = `Tienes ${count}${query.label === 'vencidos' ? '' : results.length === 1 ? singular(adjective) : adjective}${period}:`;
      const total = results.reduce((sum, i) => sum + (i.amount ?? 0), 0);
      if (total > 0) text += `\nTotal: ${formatCOP(total)}.`;
    }

    // Al preguntar por hoy, avisa de lo vencido.
    if (query.from === today && query.to === today && !done) {
      const overdue = await items.list({ to: addDays(today, -1), statuses: ['pending', 'in_progress'], categoryIds: query.categoryIds });
      if (overdue.length) text += `\nAdemás tienes ${overdue.length} ${overdue.length === 1 ? 'registro vencido' : 'registros vencidos'} de días anteriores.`;
    }
    return {
      text,
      outcomes: results.length ? [{ kind: 'listed', itemIds: results.map((i) => i.id), snapshots: results.slice(0, 30) }] : [],
      pending: null,
    };
  }
}

/** Cierra la frase con punto sin duplicarlo ("a. m." ya termina en punto). */
function endSentence(text: string): string {
  return text.endsWith('.') ? text : `${text}.`;
}

function singular(word: string): string {
  return word
    .replace(/^pendientes/, 'pendiente')
    .replace(/^ pendientes/, ' pendiente')
    .replace(/^pagos/, 'pago')
    .replace(/^cobros/, 'cobro')
    .replace(/^registros/, 'registro')
    .replace(/completados$/, 'completado');
}

function formatMinutes(min: number): string {
  if (min % 1440 === 0) return min === 1440 ? '1 día' : `${min / 1440} días`;
  if (min % 60 === 0) return min === 60 ? '1 hora' : `${min / 60} horas`;
  return `${min} minutos`;
}
