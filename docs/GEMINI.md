# Conectar Google Gemini (etapa futura)

La integración está **preparada pero desactivada**. No hay API key en el proyecto.

## Principio de seguridad
El navegador **nunca** habla con Gemini ni conoce la clave:

```
PWA ──POST /api/ai/interpret {message, context}──► Backend propio ──► Gemini API
    ◄──────────── { actions: [...] } ─────────────┘   (GEMINI_API_KEY como secreto)
```

## Qué ya existe
- `src/services/ai/types.ts`: contrato `AIProvider` y tipos de acciones.
- `src/services/ai/schema.ts`: validador de la respuesta (se aplica siempre).
- `src/services/ai/gemini/prompt.ts`: `buildSystemPrompt(ctx)` y `GEMINI_RESPONSE_SCHEMA`.
- `src/services/ai/gemini/GeminiProvider.ts`: cliente que llama al endpoint, con timeout y manejo de errores.
- `src/services/ai/index.ts`: fábrica que elige el proveedor por `VITE_AI_PROVIDER`.

## Qué falta
1. Crear la clave en Google AI Studio (la aportas tú; no se inventa).
2. Crear el backend/función serverless (p. ej. Supabase Edge Function, Vercel o Cloudflare) que:
   - reciba `{ message, context }` y valide tamaño/autenticación;
   - llame a `generateContent` con `systemInstruction = buildSystemPrompt(context)`,
     `generationConfig.responseMimeType = "application/json"` y `responseSchema = GEMINI_RESPONSE_SCHEMA`;
   - devuelva el JSON tal cual.
3. Guardar `GEMINI_API_KEY` como secreto del backend (nunca con prefijo `VITE_`).
4. Definir `VITE_AI_PROVIDER=gemini` y `VITE_AI_ENDPOINT` en `.env.local`.
5. Opcional: usar el modo demo como respaldo si el backend falla.
