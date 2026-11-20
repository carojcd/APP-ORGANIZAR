/**
 * Registra el Service Worker solo en producción (`npm run build && npm run preview`).
 * En desarrollo se omite para que la recarga en caliente de Vite no se mezcle con la caché.
 * Requiere contexto seguro: HTTPS o localhost.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) {
    console.info('[pwa] Service Worker omitido: se necesita HTTPS o localhost.');
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('[pwa] Registro fallido', error));
  });
}
