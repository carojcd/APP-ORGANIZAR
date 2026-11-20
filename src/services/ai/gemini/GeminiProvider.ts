/**
 * Proveedor Gemini (ETAPA FUTURA — no activo).
 *
 * Arquitectura de seguridad: el navegador NUNCA llama a Gemini ni conoce la
 * API key. Envía el mensaje y el contexto a un endpoint propio
 * (VITE_AI_ENDPOINT); ese backend guarda GEMINI_API_KEY como secreto,
 * llama a Gemini con `buildSystemPrompt` + `GEMINI_RESPONSE_SCHEMA` y
 * devuelve `{ actions: [...] }`. Aquí se valida esa respuesta antes de usarla.
 */
import { AppError } from '@/lib/errors';
import { parseInterpretation } from '../schema';
import type { AIProvider, InterpretContext, Interpretation } from '../types';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly label = 'Google Gemini';
  readonly isDemo = false;

  constructor(
    private readonly endpoint: string,
    private readonly timeoutMs = 20_000,
  ) {}

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
      if (!res.ok) {
        throw new AppError(`Endpoint IA respondió ${res.status}`, 'El servicio de IA no está disponible en este momento.');
      }
      return parseInterpretation(await res.json());
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Fallo de red con el endpoint de IA', 'No pude conectar con el servicio de IA.', { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}
