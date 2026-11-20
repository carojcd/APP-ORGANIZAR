/**
 * Servidor intermedio de IA (corre en Node, NUNCA en el navegador).
 *
 * Se monta dentro del servidor de Vite (`npm run dev` y `npm run preview`) en:
 *   GET  /api/ai/status     → { configured, model }
 *   POST /api/ai/interpret  → { actions: [...] }
 *
 * La clave GEMINI_API_KEY se lee de .env.local y jamás se envía al cliente.
 * Para producción, este mismo código se puede trasladar a una función serverless.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { GEMINI_RESPONSE_SCHEMA, buildSystemPrompt } from '../src/services/ai/gemini/prompt';
import type { InterpretContext } from '../src/services/ai/types';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_BODY = 64 * 1024;
const TIMEOUT_MS = 25_000;

interface Options {
  apiKey?: string;
  model?: string;
}

type Next = (err?: unknown) => void;

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, status: number, userMessage: string, detail?: string) {
  if (detail) console.warn(`[ia] ${detail}`);
  send(res, status, { error: true, userMessage });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('too_large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Elige el modelo Flash estable más reciente disponible para la clave (si no se fijó GEMINI_MODEL). */
async function discoverModel(apiKey: string): Promise<string> {
  const res = await fetch(`${API}/models?pageSize=200`, {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw Object.assign(new Error(`ListModels ${res.status}`), { status: res.status });
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const candidates = (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /^gemini-\d+(\.\d+)?-flash$/.test(n));
  const version = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
  candidates.sort((a, b) => version(b) - version(a));
  if (!candidates.length) throw new Error('No hay modelos Flash disponibles para esta clave');
  return candidates[0];
}

function userMessageForStatus(status: number): string {
  if (status === 400 || status === 401 || status === 403) return 'La clave de Gemini no es válida o no tiene permisos. Revisa GEMINI_API_KEY en .env.local.';
  if (status === 404) return 'El modelo de Gemini configurado no existe. Revisa GEMINI_MODEL en .env.local o bórralo para usar el automático.';
  if (status === 429) return 'Se alcanzó el límite de uso gratuito de Gemini. Intenta en unos minutos.';
  return 'Gemini no está disponible en este momento.';
}

export function geminiProxy({ apiKey, model: fixedModel }: Options): Plugin {
  let modelPromise: Promise<string> | null = null;
  const getModel = () => {
    if (fixedModel) return Promise.resolve(fixedModel);
    modelPromise ??= discoverModel(apiKey!).catch((e) => {
      modelPromise = null;
      throw e;
    });
    return modelPromise;
  };

  const handler = async (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const url = req.url?.split('?')[0];
    if (url !== '/api/ai/status' && url !== '/api/ai/interpret') return next();

    if (url === '/api/ai/status') {
      if (!apiKey) return send(res, 200, { configured: false });
      try {
        return send(res, 200, { configured: true, model: await getModel() });
      } catch (e) {
        const status = (e as { status?: number }).status ?? 0;
        return send(res, 200, { configured: false, error: userMessageForStatus(status) });
      }
    }

    if (req.method !== 'POST') return fail(res, 405, 'Método no permitido.');
    if (!apiKey) return fail(res, 503, 'Gemini no está configurado: falta GEMINI_API_KEY en .env.local.');

    let message: string;
    let context: InterpretContext;
    try {
      const body = JSON.parse(await readBody(req)) as { message?: unknown; context?: unknown };
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1000) throw new Error('message');
      if (typeof body.context !== 'object' || body.context === null) throw new Error('context');
      message = body.message;
      context = body.context as InterpretContext;
    } catch {
      return fail(res, 400, 'La solicitud no es válida.');
    }

    try {
      const model = await getModel();
      const gemini = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystemPrompt(context) }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
      });
      if (!gemini.ok) {
        return fail(res, 502, userMessageForStatus(gemini.status), `Gemini respondió ${gemini.status}: ${(await gemini.text()).slice(0, 300)}`);
      }
      const data = (await gemini.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return fail(res, 502, 'Gemini devolvió una respuesta que no pude leer.', `JSON inválido: ${text.slice(0, 200)}`);
      }
      return send(res, 200, parsed);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status) return fail(res, 502, userMessageForStatus(status), String(e));
      const timeout = (e as Error).name === 'TimeoutError';
      return fail(res, 504, timeout ? 'Gemini tardó demasiado en responder.' : 'No pude conectar con Gemini. Revisa tu conexión a internet.', String(e));
    }
  };

  return {
    name: 'gemini-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => void handler(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void handler(req, res, next));
    },
  };
}
