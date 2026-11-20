/**
 * Instrucciones de sistema y esquema de respuesta para Gemini (ETAPA FUTURA).
 *
 * Este archivo NO se envía a Gemini desde el navegador. Se exporta para que
 * el backend (proxy) lo use, de modo que frontend y backend compartan un
 * único contrato. Ver docs/GEMINI.md.
 */
import type { InterpretContext } from '../types';

export function buildSystemPrompt(ctx: InterpretContext): string {
  const categories = ctx.categories.map((c) => `- ${c.id}: ${c.label}. ${c.description}`).join('\n');
  return `Eres el intérprete de un asistente personal de organización para una persona en Colombia.
Tu única tarea es convertir el mensaje del usuario en acciones JSON según el esquema. No conversas libremente.

Contexto:
- Fecha y hora actual: ${ctx.now} (zona ${ctx.timeZone}). Hoy es ${ctx.today}.
- Idioma: español de Colombia. Moneda: COP (pesos, enteros, sin decimales).
- Fechas en formato AAAA-MM-DD y horas en HH:mm (24 h).

Categorías válidas (categoryId):
${categories}

Reglas estrictas:
1. NUNCA inventes fechas. Si la fecha es ambigua ("la próxima semana", "el fin de semana", "en diciembre"), responde con una acción "clarify" y opciones.
2. Si la hora va de 1 a 12 sin indicar mañana/tarde/noche/a. m./p. m., pregunta con "clarify" (missing: "meridiem").
3. "mañana" = hoy+1; "pasado mañana" = hoy+2; "este <día>" = esa semana desde hoy; "el próximo <día>" = siguiente ocurrencia después de hoy; "dentro de N días" = hoy+N.
4. Para modificar, completar o eliminar, describe el registro en "target" (texto y/o fecha) o usa su id si aparece en openItems. Nunca inventes ids.
5. Para pagos usa categoryId "finance", amount en pesos y dueDate igual a la fecha de pago.
6. Las consultas ("¿qué tengo hoy?") se responden con "query_items"; tú no redactas la lista.
7. No afirmes que algo se guardó: solo propones acciones. La aplicación las ejecuta y confirma.

Aclaración pendiente: ${ctx.pending ? JSON.stringify(ctx.pending) : 'ninguna'}
Registros abiertos (para resolver referencias): ${JSON.stringify(ctx.openItems.slice(0, 50))}`;
}

/**
 * Esquema de salida estructurada (subconjunto OpenAPI que admite Gemini en
 * `generationConfig.responseSchema`). Debe mantenerse alineado con
 * services/ai/types.ts y services/ai/schema.ts.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: {
            type: 'STRING',
            enum: ['create_item', 'update_item', 'complete_item', 'delete_item', 'query_items', 'clarify', 'reply'],
          },
          item: { type: 'OBJECT', nullable: true, properties: itemProps() },
          changes: { type: 'OBJECT', nullable: true, properties: itemProps() },
          target: {
            type: 'OBJECT',
            nullable: true,
            properties: {
              id: { type: 'STRING', nullable: true },
              text: { type: 'STRING', nullable: true },
              categoryId: { type: 'STRING', nullable: true },
              date: { type: 'STRING', nullable: true },
            },
          },
          query: {
            type: 'OBJECT',
            nullable: true,
            properties: {
              from: { type: 'STRING', nullable: true },
              to: { type: 'STRING', nullable: true },
              categoryIds: { type: 'ARRAY', nullable: true, items: { type: 'STRING' } },
              statuses: { type: 'ARRAY', nullable: true, items: { type: 'STRING' } },
              onlyWithAmount: { type: 'BOOLEAN', nullable: true },
              label: { type: 'STRING', nullable: true },
            },
          },
          question: { type: 'STRING', nullable: true },
          text: { type: 'STRING', nullable: true },
        },
        required: ['type'],
      },
    },
  },
  required: ['actions'],
} as const;

function itemProps() {
  return {
    title: { type: 'STRING', nullable: true },
    description: { type: 'STRING', nullable: true },
    categoryId: { type: 'STRING', nullable: true },
    date: { type: 'STRING', nullable: true },
    time: { type: 'STRING', nullable: true },
    priority: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
    reminderMinutesBefore: { type: 'INTEGER', nullable: true },
    amount: { type: 'NUMBER', nullable: true },
    direction: { type: 'STRING', enum: ['pay', 'collect'], nullable: true },
    dueDate: { type: 'STRING', nullable: true },
    status: { type: 'STRING', enum: ['pending', 'in_progress', 'done'], nullable: true },
  };
}
