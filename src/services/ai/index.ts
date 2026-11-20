import { env } from '@/config/env';
import { toUserMessage } from '@/lib/errors';
import { DemoProvider } from './demo/DemoProvider';
import { GeminiProvider } from './gemini/GeminiProvider';
import type { AIProvider, InterpretContext, Interpretation } from './types';

/**
 * Usa Gemini y, si falla (sin internet, límite de uso, clave inválida),
 * interpreta con el modo demostración y lo avisa en la respuesta.
 */
class ResilientProvider implements AIProvider {
  readonly id = 'gemini';
  readonly isDemo = false;
  constructor(
    private readonly primary: AIProvider,
    private readonly fallback: AIProvider,
  ) {}
  get label() {
    return this.primary.label;
  }
  async interpret(message: string, context: InterpretContext): Promise<Interpretation> {
    try {
      return await this.primary.interpret(message, context);
    } catch (error) {
      console.warn('[ia] Gemini falló, se usa el modo demostración:', error);
      const result = await this.fallback.interpret(message, context);
      return {
        actions: [
          { type: 'reply', text: `⚠️ ${toUserMessage(error)} Usé el modo demostración para esta respuesta.` },
          ...result.actions,
        ],
      };
    }
  }
}

interface AIStatus {
  configured: boolean;
  model?: string;
  error?: string;
}

async function fetchStatus(): Promise<AIStatus> {
  try {
    const url = env.aiEndpoint.replace(/\/interpret$/, '/status');
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { configured: false };
    return (await res.json()) as AIStatus;
  } catch {
    return { configured: false };
  }
}

export interface AIInit {
  provider: AIProvider;
  /** Motivo por el que no se activó Gemini (para mostrar en configuración). */
  notice?: string;
}

/**
 * Elige el proveedor al iniciar:
 *  - VITE_AI_PROVIDER=demo  → siempre modo demostración.
 *  - por defecto ("auto")   → Gemini si el servidor tiene GEMINI_API_KEY; si no, demo.
 */
export async function initAIProvider(): Promise<AIInit> {
  const demo = new DemoProvider();
  if (env.aiProvider === 'demo') return { provider: demo };
  const status = await fetchStatus();
  if (!status.configured) return { provider: demo, notice: status.error };
  return { provider: new ResilientProvider(new GeminiProvider(env.aiEndpoint, status.model), demo) };
}

export type { AIProvider } from './types';
