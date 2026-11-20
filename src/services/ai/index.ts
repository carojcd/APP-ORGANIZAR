import { env } from '@/config/env';
import { DemoProvider } from './demo/DemoProvider';
import { GeminiProvider } from './gemini/GeminiProvider';
import type { AIProvider } from './types';

let instance: AIProvider | null = null;

/**
 * Fábrica del proveedor de IA. Por defecto: modo demostración.
 * Gemini solo se activa con VITE_AI_PROVIDER=gemini Y un backend propio en
 * VITE_AI_ENDPOINT (ver docs/GEMINI.md). En esta etapa no está habilitado.
 */
export function getAIProvider(): AIProvider {
  if (instance) return instance;
  instance = env.aiProvider === 'gemini' ? new GeminiProvider(env.aiEndpoint) : new DemoProvider();
  return instance;
}

export type { AIProvider } from './types';
