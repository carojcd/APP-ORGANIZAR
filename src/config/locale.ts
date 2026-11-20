/**
 * Configuración regional única de la aplicación.
 * Todo cálculo de "hoy", formato de fecha, hora o moneda debe pasar por aquí.
 */
export const LOCALE = {
  language: 'es-CO',
  country: 'CO',
  timeZone: 'America/Bogota',
  currency: 'COP',
  /** Formato visible de fecha. */
  dateFormat: 'DD/MM/AAAA',
  /** Reloj de 12 horas con a. m./p. m. */
  hour12: true,
  /** Idioma del reconocimiento de voz. */
  speechLang: 'es-CO',
  /** La semana empieza el lunes. */
  weekStartsOn: 1,
} as const;
