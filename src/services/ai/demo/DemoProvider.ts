/**
 * Proveedor de IA de DEMOSTRACIÓN.
 *
 * Intérprete local por reglas para español de Colombia. No usa red ni
 * modelos: sirve para probar la interfaz completa y define el mismo
 * contrato (acciones JSON) que usará Gemini.
 */
import { addDays, endOfWeek } from '@/lib/dates';
import { formatTime } from '@/lib/format';
import { similarity } from '@/lib/text';
import type { CategoryId, ItemStatus, QuickReply } from '@/domain/types';
import type {
  AIProvider,
  ActionItemChanges,
  ActionItemDraft,
  AssistantAction,
  InterpretContext,
  Interpretation,
  ItemQuery,
  PendingIntent,
} from '../types';
import { extractAmount } from './amountParser';
import { classify, detectDirection, detectPriority } from './classifier';
import { extractDate, extractRange, type DateResult } from './dateParser';
import { NUM, parseNumber } from './numbers';
import { applyMeridiem, extractTime, parseMeridiemReply, toTimeKey, type TimeResult } from './timeParser';
import { buildTitle, cleanTarget } from './titleBuilder';
import { Utterance, fold } from './utterance';

type Ctx = Pick<InterpretContext, 'today' | 'pending'>;

const reply = (text: string): Interpretation => ({ actions: [{ type: 'reply', text }] });
const one = (action: AssistantAction): Interpretation => ({ actions: [action] });

export const HELP_TEXT =
  'Puedo anotar tareas, citas y pagos, y responder qué tienes pendiente. Prueba con:\n' +
  '• "Mañana tengo reunión con Don Vitto a las 9 de la mañana"\n' +
  '• "Recuérdame pagar Falabella el próximo viernes"\n' +
  '• "¿Qué tengo pendiente hoy?"\n' +
  '• "Marca como completada la entrega de FLM"\n' +
  '• "Cambia la reunión de mañana para las 3 de la tarde"';

export const EXAMPLE_PROMPTS: QuickReply[] = [
  { label: '¿Qué tengo hoy?', value: '¿Qué tengo pendiente hoy?' },
  { label: 'Pagos del mes', value: '¿Qué pagos tengo pendientes este mes?' },
  { label: 'Esta semana', value: '¿Qué tengo esta semana?' },
  { label: 'Ayuda', value: '¿Qué puedes hacer?' },
];

/* ───────────── Utilidades ───────────── */

function meridiemQuestion(hour: number, minute: number): { question: string; options: QuickReply[] } {
  const am = formatTime(toTimeKey(hour === 12 ? 0 : hour, minute));
  const pm = formatTime(toTimeKey(hour === 12 ? 12 : hour + 12, minute));
  return {
    question: `¿A las ${hour}:${String(minute).padStart(2, '0')} de la mañana o de la tarde/noche?`,
    options: [
      { label: am, value: am },
      { label: pm, value: pm },
    ],
  };
}

function dateQuestion(): { question: string; options: QuickReply[] } {
  return {
    question: '¿Para qué día?',
    options: [
      { label: 'Hoy', value: 'Hoy' },
      { label: 'Mañana', value: 'Mañana' },
      { label: 'Pasado mañana', value: 'Pasado mañana' },
    ],
  };
}

/** ¿El registro es una entrega o un pago (la fecha también es su vencimiento)? */
function isDeadlineLike(item: Pick<ActionItemDraft, 'title' | 'categoryId'>): boolean {
  return item.categoryId === 'finance' || /\b(entreg|venc|plazo|radicar|pagar|pago|cuota|factura)/.test(fold(item.title));
}

function withDate(item: ActionItemDraft, date: DateResult & { kind: 'date' }): ActionItemDraft {
  if (date.deadline) return { ...item, date: null, dueDate: date.date };
  return { ...item, date: date.date, dueDate: isDeadlineLike(item) ? date.date : item.dueDate ?? null };
}

/**
 * Decide entre crear o preguntar. Nunca inventa fecha ni a. m./p. m.
 */
function finalizeCreate(item: ActionItemDraft, time: TimeResult, date: DateResult): Interpretation {
  if (date?.kind === 'invalid') return reply(`${date.message} ¿Me indicas otra fecha?`);

  let draft = { ...item };
  if (date?.kind === 'date') draft = withDate(draft, date);
  if (time?.kind === 'time') draft.time = time.time;

  const hasDate = Boolean(draft.date || draft.dueDate);
  const pendingMeridiem = time?.kind === 'needsMeridiem' ? { hour: time.hour, minute: time.minute } : undefined;
  const action = { type: 'create_item' as const, item: draft };

  if (date?.kind === 'ambiguous') {
    return one({
      type: 'clarify',
      question: date.question,
      options: date.options,
      pending: { action, missing: 'date', thenMeridiem: pendingMeridiem },
    });
  }
  if (!hasDate && (draft.time || pendingMeridiem)) {
    const q = dateQuestion();
    return one({ type: 'clarify', ...q, pending: { action, missing: 'date', thenMeridiem: pendingMeridiem } });
  }
  if (pendingMeridiem) {
    const q = meridiemQuestion(pendingMeridiem.hour, pendingMeridiem.minute);
    return one({ type: 'clarify', ...q, pending: { action, missing: 'meridiem', ...pendingMeridiem } });
  }
  return one(action);
}

function finalizeUpdate(
  action: Extract<AssistantAction, { type: 'update_item' }>,
  time: TimeResult,
  date: DateResult,
): Interpretation {
  if (date?.kind === 'invalid') return reply(`${date.message} ¿Me indicas otra fecha?`);
  const changes: ActionItemChanges = { ...action.changes };
  if (date?.kind === 'date') changes.date = date.date;
  if (time?.kind === 'time') changes.time = time.time;
  const next = { ...action, changes };
  const pendingMeridiem = time?.kind === 'needsMeridiem' ? { hour: time.hour, minute: time.minute } : undefined;
  if (date?.kind === 'ambiguous') {
    return one({
      type: 'clarify',
      question: date.question,
      options: date.options,
      pending: { action: next, missing: 'date', thenMeridiem: pendingMeridiem },
    });
  }
  if (pendingMeridiem) {
    const q = meridiemQuestion(pendingMeridiem.hour, pendingMeridiem.minute);
    return one({ type: 'clarify', ...q, pending: { action: next, missing: 'meridiem', ...pendingMeridiem } });
  }
  if (Object.keys(changes).length === 0) {
    return reply('¿Qué quieres cambiar? Por ejemplo: "Cambia la reunión de mañana para las 3 de la tarde".');
  }
  return one(next);
}

/* ───────────── Recordatorios ───────────── */

const REMINDER_RE =
  /\b(recuerdame|recordarme|recuerdeme|recuerda(?:me)?|avisame|no\s+me\s+dejes\s+olvidar|que\s+no\s+se\s+me\s+olvide|no\s+olvides)\b/;

function extractReminder(u: Utterance): number | null | undefined {
  const before = u.match(new RegExp(`\\b(?:y\\s+)?(?:avisame|recuerdame)?\\s*(${NUM}|media)\\s+(minutos?|horas?|dias?)\\s+antes\\b`));
  let minutes: number | undefined;
  if (before) {
    const n = before[1] === 'media' ? 0.5 : parseNumber(before[1]) ?? 1;
    const unit = before[2];
    minutes = Math.round(unit.startsWith('min') ? n : unit.startsWith('hora') ? n * 60 : n * 1440);
    u.consumeMatch(before);
  }
  const asks = REMINDER_RE.test(u.folded);
  if (minutes !== undefined) return minutes;
  return asks ? null : undefined; // null = recordatorio con valor por defecto
}

/* ───────────── Intenciones ───────────── */

function parseCreate(text: string, today: string): Interpretation {
  const u = new Utterance(text);
  const reminder = extractReminder(u);
  const amount = extractAmount(u);
  const time = extractTime(u);
  const date = extractDate(u, today);
  const priorityMatch = u.match(
    /\b(?:es\s+)?(?:urgente|urgentemente|importante|con\s+prioridad\s+(?:alta|baja|media)|prioridad\s+(?:alta|baja|media)|(?:alta|baja)\s+prioridad|sin\s+falta|sin\s+prisa|cuando\s+pueda|no\s+es\s+urgente)\b/,
  );
  const priority = detectPriority(text);
  if (priorityMatch) u.consumeMatch(priorityMatch);

  const title = buildTitle(u.remainder());
  if (!title || title.length < 2) {
    return reply('¿Qué quieres que anote? Por ejemplo: "Mañana tengo cita médica a las 10 de la mañana".');
  }
  const categoryId = classify(text, amount != null);
  const item: ActionItemDraft = {
    title,
    categoryId,
    priority: priority ?? 'medium',
    amount: amount ?? null,
    direction: categoryId === 'finance' ? detectDirection(text) : null,
    reminderMinutesBefore: reminder === undefined ? undefined : reminder ?? (time ? 15 : 0),
  };
  return finalizeCreate(item, time, date);
}

const QUERY_CATEGORIES: [RegExp, CategoryId][] = [
  [/\b(pagos?|cuentas?|deudas?|cuotas?|facturas?|finanzas|dinero|plata|cobrar|cobros?|debo\s+pagar|me\s+deben|cuanto\s+debo)\b/, 'finance'],
  [/\b(trabajo|laboral(?:es)?|oficina|reuniones)\b/, 'work'],
  [/\b(freelance|clientes?)\b/, 'freelance'],
  [/\b(personal(?:es)?|diligencias)\b/, 'personal'],
];

export function parseQuery(text: string, today: string): ItemQuery {
  const u = new Utterance(text);
  const f = u.folded;
  const query: ItemQuery = {};

  const cats = QUERY_CATEGORIES.filter(([re]) => re.test(f)).map(([, id]) => id);
  if (cats.length) query.categoryIds = [...new Set(cats)];
  if (/\b(me\s+deben|por\s+cobrar|cobrar)\b/.test(f)) query.direction = 'collect';
  else if (/\b(debo|pagar|pagos)\b/.test(f) && cats.includes('finance')) query.direction = 'pay';

  let statuses: ItemStatus[] | undefined = ['pending', 'in_progress'];
  if (/\b(complete|completad\w*|termine|terminad\w*|hice|hech[ao]s?|realizad\w*|pague|pagad[ao]s)\b/.test(f)) statuses = ['done'];
  else if (/\b(todo|todos|todas)\b/.test(f) && !/\bpendiente/.test(f)) statuses = undefined;
  query.statuses = statuses;

  if (/\b(vencid\w*|atrasad\w*|retrasad\w*|se\s+me\s+paso)\b/.test(f)) {
    query.to = addDays(today, -1);
    query.statuses = ['pending', 'in_progress'];
    query.label = 'vencidos';
    return query;
  }
  if (/\b(proximos?\s+vencimientos?|que\s+vence|vence\s+pronto|por\s+vencer)\b/.test(f)) {
    query.from = today;
    query.to = addDays(today, 14);
    query.label = 'en los próximos 14 días';
    return query;
  }
  const range = extractRange(u, today);
  if (range) {
    query.from = range.from;
    query.to = range.to;
    query.label = range.label;
  } else if (/\bsemana\b/.test(f)) {
    query.from = today;
    query.to = endOfWeek(today);
    query.label = 'esta semana';
  }
  return query;
}

const COMPLETE_PATTERNS = [
  /^(?:ya\s+)?(?:marca(?:r|lo|la|me)?|pon(?:er|lo|la)?|deja(?:r|lo|la)?)\s+(?:como\s+)?(?:completad|hech|list|terminad|pagad|realizad|cumplid)[ao]s?\s+/,
  /^(?:ya\s+)?(?:complete|termine|hice|pague|entregue|realice|finalice|cumpli|envie|mande|completa(?:r)?|termina(?:r)?|finaliza(?:r)?)\s+/,
  /^(?:ya\s+)?(?:esta|quedo)\s+(?:list|hech|pagad|terminad|completad)[ao]\s+/,
];
const COMPLETE_SUFFIX = /\s+(?:ya\s+)?(?:esta|quedo)\s+(?:list|hech|pagad|terminad|completad)[ao]\s*$/;
const DELETE_RE = /^(?:elimina(?:r|lo|la)?|borra(?:r|lo|la)?|quita(?:r|lo|la)?|cancela(?:r|lo|la)?|suprime|saca)\s+/;
const UPDATE_RE =
  /^(?:cambia(?:r|me)?|mueve(?:la|lo)?|mover|pasa(?:r|la|lo)?|reprograma(?:r)?|aplaza(?:r)?|pospon(?:er)?|posterga(?:r)?|corre(?:r|la|lo)?|modifica(?:r)?|actualiza(?:r)?|ajusta(?:r)?)\s+/;

function targetFrom(u: Utterance, today: string) {
  const date = extractDate(u, today);
  const text = cleanTarget(u.remainder());
  return { text: text || undefined, date: date?.kind === 'date' ? date.date : undefined };
}

function parseUpdate(text: string, verbLength: number, today: string): Interpretation {
  const rest = text.slice(verbLength);
  const f = fold(rest);
  const sep = /\s(?:para|a|al|hacia)\s+(?=(?:las?\s|el\s|este\s|esta\s|hoy|manana|pasado|proximo|\d|\$|lunes|martes|miercoles|jueves|viernes|sabado|domingo|mediodia|medianoche|prioridad|alta\b|baja\b|media\b|fin|dentro|en\s+\d))/g;
  let cut = -1;
  for (const m of f.matchAll(sep)) cut = m.index ?? -1;
  if (cut < 0) return reply('¿Para cuándo lo cambio? Por ejemplo: "Cambia la reunión de mañana para las 3 de la tarde".');

  const target = targetFrom(new Utterance(rest.slice(0, cut)), today);
  const cu = new Utterance(rest.slice(cut).trim());
  const changes: ActionItemChanges = {};
  const amount = extractAmount(cu);
  if (amount != null) changes.amount = amount;
  const pr = cu.match(/\b(?:prioridad\s+)?(alta|media|baja)\b/);
  if (pr) {
    changes.priority = pr[1] === 'alta' ? 'high' : pr[1] === 'baja' ? 'low' : 'medium';
    cu.consumeMatch(pr);
  }
  const time = extractTime(cu);
  const date = extractDate(cu, today);
  return finalizeUpdate({ type: 'update_item', target, changes }, time, date);
}

/* ───────────── Aclaraciones pendientes ───────────── */

const ORDINALS: Record<string, number> = { primera: 1, primero: 1, segunda: 2, segundo: 2, tercera: 3, tercero: 3, cuarta: 4, cuarto: 4 };

function resolvePending(text: string, pending: PendingIntent, today: string): Interpretation | null {
  const f = fold(text).trim();
  if (/^(?:cancela(?:r)?|olvidalo|olvida|no|nada|dejalo|deja\s+asi|ninguno|ninguna)\b/.test(f)) {
    return reply('Listo, no hice ningún cambio.');
  }
  const action = pending.action;

  if (pending.missing === 'target') {
    const candidates = pending.candidates ?? [];
    let index: number | null = null;
    const num = /^(?:la\s+|el\s+|opcion\s+|numero\s+)?(\d)\b/.exec(f);
    if (num) index = Number(num[1]);
    const ord = /\b(primer[ao]?|segund[ao]|tercer[ao]?|cuart[ao])\b/.exec(f);
    if (index == null && ord) index = ORDINALS[ord[1]] ?? (ord[1].startsWith('primer') ? 1 : ord[1].startsWith('tercer') ? 3 : null);
    let chosen = index != null ? candidates[index - 1] : undefined;
    if (!chosen) {
      const scored = candidates.map((c) => ({ c, s: similarity(text, c.title) })).sort((a, b) => b.s - a.s);
      if (scored[0] && scored[0].s >= 0.5 && (!scored[1] || scored[0].s > scored[1].s)) chosen = scored[0].c;
    }
    if (!chosen) return null;
    return one({ ...action, target: { id: chosen.id } } as AssistantAction);
  }

  if (pending.missing === 'meridiem') {
    const u = new Utterance(text);
    const t = extractTime(u);
    let time: string | null = t?.kind === 'time' ? t.time : null;
    if (!time) {
      const mer = parseMeridiemReply(f);
      const r = mer ? applyMeridiem(pending.hour ?? 0, pending.minute ?? 0, mer) : null;
      if (r) time = toTimeKey(r.h, r.m);
    }
    if (!time) return null;
    if (action.type === 'create_item') return finalizeCreate(action.item, { kind: 'time', time }, null);
    if (action.type === 'update_item') return finalizeUpdate(action, { kind: 'time', time }, null);
    return null;
  }

  // missing === 'date'
  const u = new Utterance(text);
  const t = extractTime(u);
  const d = extractDate(u, today);
  if (!d) return null;
  const time: TimeResult =
    t ?? (pending.thenMeridiem ? { kind: 'needsMeridiem', ...pending.thenMeridiem } : null);
  if (action.type === 'create_item') return finalizeCreate(action.item, time, d);
  if (action.type === 'update_item') return finalizeUpdate(action, time, d);
  return null;
}

/* ───────────── Punto de entrada ───────────── */

export function interpretDemo(message: string, ctx: Ctx): Interpretation {
  const text = message.trim().replace(/\s+/g, ' ');
  if (!text) return reply('Escríbeme o díctame lo que necesitas anotar o consultar.');

  if (ctx.pending) {
    const resolved = resolvePending(text, ctx.pending, ctx.today);
    if (resolved) return resolved;
  }

  // Quita cortesías iniciales para detectar la intención.
  const polite = /^(?:(?:oye|hola|porfa|porfavor|por\s+favor|asistente|bueno|ok|listo)[\s,]+)+/.exec(fold(text));
  const body = polite ? text.slice(polite[0].length) : text;
  const f = fold(body).trim();

  if (/^(hola|buenas|buenos\s+dias|buenas\s+tardes|buenas\s+noches|hey|que\s+mas|quiubo)\b/.test(fold(text)) && f.split(' ').length <= 3) {
    return reply('¡Hola! ¿Qué quieres organizar hoy? Puedo anotar tareas y pagos, o decirte qué tienes pendiente.');
  }
  if (/^(gracias|muchas\s+gracias|mil\s+gracias|perfecto|genial|excelente|listo|ok|vale|dale)\b/.test(f) && f.split(' ').length <= 3) {
    return reply('¡Con gusto! Aquí estoy cuando me necesites.');
  }
  if (/\b(ayuda|que\s+puedes\s+hacer|como\s+funciona\w*|que\s+sabes\s+hacer|como\s+te\s+uso)\b/.test(f)) {
    return reply(HELP_TEXT);
  }

  // Completar
  for (const re of COMPLETE_PATTERNS) {
    const m = re.exec(f);
    if (m) return one({ type: 'complete_item', target: targetFrom(new Utterance(body.slice(m[0].length)), ctx.today) });
  }
  const suffix = COMPLETE_SUFFIX.exec(f);
  if (suffix) return one({ type: 'complete_item', target: targetFrom(new Utterance(body.slice(0, suffix.index)), ctx.today) });

  // Eliminar
  const del = DELETE_RE.exec(f);
  if (del) {
    const target = targetFrom(new Utterance(body.slice(del[0].length)), ctx.today);
    if (!target.text && !target.date) return reply('¿Qué registro quieres eliminar?');
    return one({ type: 'delete_item', target });
  }

  // Modificar
  const upd = UPDATE_RE.exec(f);
  if (upd) return parseUpdate(body, upd[0].length, ctx.today);

  // Consultar
  const isQuestion =
    /^(que|cuales?|cuantos?|cuantas?|muestrame|mostrar|mostrame|ver|lista|listame|dime|resumen|como\s+voy|como\s+va)\b/.test(f) ||
    (text.includes('?') && /^(tengo|hay|debo)\b/.test(f));
  if (isQuestion && !/^que\s+no\s+se\s+me\s+olvide/.test(f)) {
    return one({ type: 'query_items', query: parseQuery(body, ctx.today) });
  }

  // Crear (por defecto)
  return parseCreate(body, ctx.today);
}

export class DemoProvider implements AIProvider {
  readonly id = 'demo';
  readonly label = 'Modo demostración (intérprete local)';
  readonly isDemo = true;

  async interpret(message: string, context: InterpretContext): Promise<Interpretation> {
    // Pequeña pausa para que la interfaz muestre el estado "pensando" como lo haría un modelo real.
    await new Promise((r) => setTimeout(r, 350));
    return interpretDemo(message, context);
  }
}
