/**
 * Proveedor Gemini.
 *
 * El navegador NUNCA llama a Gemini ni conoce la API key: envía el mensaje y
 * el contexto al servidor intermedio propio (VITE_AI_ENDPOINT, por defecto
 * /api/ai/interpret), que guarda GEMINI_API_KEY. La respuesta se valida aquí
 * antes de ejecutar cualquier acción.
 */
import { AppError } from '@/lib/errors';
import { parseInterpretation } from '../schema';
import type { AIProvider, InterpretContext, Interpretation } from '../types';

/** Gemini devuelve null en campos no usados; los quitamos para no borrar datos al actualizar. */
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, stripNulls(v)]),
    );
  }
  return value;
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly isDemo = false;
  readonly label: string;

  constructor(
    private readonly endpoint: string,
    model?: string,
    private readonly timeoutMs = 30_000,
  ) {
    this.label = model ? `Google Gemini · ${model}` : 'Google Gemini';
  }

  async interpret(message: string, context: InterpretContext): Promise<Interpretation> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context }),
        signal: controller.signal,
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const userMessage =
          data && typeof data === 'object' && 'userMessage' in data && typeof data.userMessage === 'string'
            ? data.userMessage
            : 'El servicio de IA no está disponible en este momento.';
        throw new AppError(`Endpoint IA respondió ${res.status}`, userMessage);
      }
      return parseInterpretation(stripNulls(data));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Fallo de red con el endpoint de IA', 'No pude conectar con el servicio de IA.', { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}
