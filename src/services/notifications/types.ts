/**
 * Contrato de notificaciones. Hoy: notificaciones locales mientras la app
 * está abierta. Etapa futura: Firebase Cloud Messaging (push con la app
 * cerrada), implementando esta misma interfaz.
 */
export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
}

export interface NotificationService {
  readonly name: string;
  isSupported(): boolean;
  permission(): NotificationPermission | 'unsupported';
  requestPermission(): Promise<NotificationPermission | 'unsupported'>;
  notify(payload: NotificationPayload): Promise<boolean>;
}
