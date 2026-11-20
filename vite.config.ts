import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath, URL } from 'node:url';
import { geminiProxy } from './server/geminiProxy.ts';

// `npm run dev`        → HTTP en la red local (http://IP:5173)
// `npm run dev:https`  → HTTPS autofirmado; necesario para el micrófono en Android.
export default defineConfig(({ mode }) => {
  // Carga TODAS las variables de .env.local solo en Node. Las que no empiezan
  // por VITE_ (como GEMINI_API_KEY) nunca llegan al navegador.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
  plugins: [
    react(),
    tailwindcss(),
    geminiProxy({ apiKey: env.GEMINI_API_KEY?.trim() || undefined, model: env.GEMINI_MODEL?.trim() || undefined }),
    ...(mode === 'https' ? [basicSsl()] : []),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  };
});
