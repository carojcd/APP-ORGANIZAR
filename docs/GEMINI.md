# Google Gemini

## Activarlo (en tu computador)
1. En la carpeta del proyecto crea un archivo llamado **`.env.local`** con esta línea (tu clave, sin comillas ni espacios):
   ```
   GEMINI_API_KEY=AIza...tu_clave
   ```
2. Si `npm run dev` estaba corriendo, deténlo (Ctrl + C) y vuelve a ejecutarlo.
3. En el Asistente, el indicador debe decir **"Google Gemini · <modelo>"**.

`.env.local` está en `.gitignore`: nunca se sube a GitHub. No compartas la clave por chat ni capturas.

Opcional: `GEMINI_MODEL=nombre-del-modelo` para fijar un modelo. Si no lo pones, el servidor elige el modelo *Flash* más reciente disponible para tu clave.

## Cómo funciona
```
PWA ──POST /api/ai/interpret {message, context}──► server/geminiProxy.ts (Node, dentro de Vite) ──► Gemini API
    ◄──────────── { actions: [...] } ────────────┘   lee GEMINI_API_KEY de .env.local
```
- El navegador nunca ve la clave: Vite solo expone variables con prefijo `VITE_`.
- Instrucciones y esquema JSON compartidos: `src/services/ai/gemini/prompt.ts`.
- La respuesta se valida en `src/services/ai/schema.ts` antes de ejecutar nada.
- Si Gemini falla (sin internet, límite gratuito, clave inválida), el asistente lo avisa y usa el modo demostración para ese mensaje.
- Para forzar el modo demostración: `VITE_AI_PROVIDER=demo` en `.env.local`.

## Solución de problemas
| Lo que ves | Qué hacer |
|---|---|
| Sigue diciendo "Modo demostración" | Revisa que el archivo se llame exactamente `.env.local` (no `.env.local.txt`), que esté en la carpeta del proyecto y reinicia `npm run dev`. En Configuración aparece el motivo. |
| "La clave de Gemini no es válida" | Copia de nuevo la clave desde Google AI Studio. |
| "Se alcanzó el límite de uso gratuito" | Espera unos minutos; el plan gratuito tiene límites por minuto y por día. |

## Producción (más adelante)
`npm run dev` / `npm run preview` incluyen el servidor intermedio. Al publicar la app en internet habrá que mover `server/geminiProxy.ts` a una función serverless (Supabase Edge Functions, Vercel, Cloudflare) con la clave como secreto.
