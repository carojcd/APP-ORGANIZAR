/**
 * Instrucciones de sistema y esquema de respuesta para Gemini.
 *
 * Lo usa el servidor intermedio (server/geminiProxy.ts); el navegador nunca
 * llama a Gemini. Frontend y backend comparten así un único contrato.
 * No importar aquí módulos con alias "@/": este archivo también se carga en Node.
 */
import type { InterpretContext } from '../types';

export function buildSystemPrompt(ctx: InterpretContext): string {
  const categories = ctx.categories.map((c) => `- ${c.id}: ${c.label}. ${c.description}`).join('\n');
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const weekday = days[new Date(`${ctx.today}T12:00:00Z`).getUTCDay()];
  const localTime = new Intl.DateTimeFormat('es-CO', { timeZone: ctx.timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ctx.now));
  return `Eres el intérprete de un asistente personal de organización para una persona en Colombia.
Tu única tarea es convertir el mensaje del usuario en acciones JSON según el esquema. No conversas libremente.

Contexto:
- Hoy es ${weekday} ${ctx.today}; hora local ${localTime} (zona ${ctx.timeZone}).
- Idioma: español de Colombia. Moneda: COP (pesos, enteros, sin decimales).
- Fechas en formato AAAA-MM-DD y horas en HH:mm (24 h).

Categorías válidas (categoryId):
${categories}

Reglas estrictas:
1. NUNCA inventes fechas. Si la fecha es ambigua ("la próxima semana", "el fin de semana", "en diciembre"), responde con "clarify" y ofrece opciones (label corto, value = respuesta completa, p. ej. "El lunes 23/11/2026").
2. Si la hora va de 1 a 12 sin indicar mañana/tarde/noche/a. m./p. m., pregunta con "clarify" (opciones a. m. y p. m.). Si hay hora pero no fecha, pregunta el día.
3. "mañana" = hoy+1; "pasado mañana" = hoy+2; "este <día>" = esa semana desde hoy (hoy incluido); "el próximo <día>" = siguiente ocurrencia después de hoy; "<día> de la próxima semana" = semana calendario siguiente (lunes a domingo); "dentro de N días" = hoy+N. Si dicen "el viernes" y hoy es viernes, pregunta.
4. Si el usuario está respondiendo a una pregunta tuya (mira el historial), combina su respuesta con la solicitud original y devuelve la acción completa.
5. Para modificar, completar o eliminar, usa el "id" exacto si el registro aparece en "Registros abiertos"; si no, describe el registro en target.text (palabras clave del título) y target.date. Nunca inventes ids.
6. Títulos: cortos, en infinitivo o sustantivo, con mayúscula inicial, sin la fecha ni la hora ("Reunión con Don Vitto", "Pagar Falabella").
7. Pagos: categoryId "finance", amount en pesos enteros (350.000 → 350000), direction "pay" o "collect" (me deben / cobrar), dueDate igual a la fecha. Entregas: dueDate igual a la fecha.
8. "Recuérdame…" activa reminderMinutesBefore (15 si hay hora, 0 si no; "un día antes" = 1440).
9. Consultas ("¿qué tengo hoy?", "¿qué pagos tengo este mes?") → "query_items" con from/to, categoryIds y statuses (["pending","in_progress"] para pendientes, ["done"] para completadas) y un label ("hoy", "este mes"). Tú no redactas la lista.
10. Saludos, agradecimientos o preguntas generales → "reply" breve en español. Si piden algo que la app no hace, dilo con amabilidad.
11. No afirmes que algo se guardó: solo propones acciones. La aplicación las ejecuta y confirma.
12. Omite (null) los campos que no apliquen. En "changes" incluye SOLO lo que cambia.

Historial reciente:
${(ctx.history ?? []).map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.text}`).join('\n') || '(sin historial)'}

Registros abiertos (para resolver referencias): ${JSON.stringify(ctx.openItems.slice(0, 60))}`;
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
              direction: { type: 'STRING', enum: ['pay', 'collect'], nullable: true },
            },
          },
          question: { type: 'STRING', nullable: true },
          options: {
            type: 'ARRAY',
            nullable: true,
            items: {
              type: 'OBJECT',
              properties: { label: { type: 'STRING' }, value: { type: 'STRING' } },
              required: ['label', 'value'],
            },
          },
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
