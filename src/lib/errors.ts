/** Errores de aplicación con mensaje apto para mostrar al usuario. */
export class AppError extends Error {
  readonly userMessage: string;
  constructor(message: string, userMessage?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.userMessage = userMessage ?? message;
  }
}

export class ValidationError extends AppError {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Validación fallida: ${issues.join('; ')}`, issues[0]);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export class NotConfiguredError extends AppError {
  constructor(what: string) {
    super(`${what} no está configurado`, `${what} todavía no está configurado en esta etapa.`);
    this.name = 'NotConfiguredError';
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
