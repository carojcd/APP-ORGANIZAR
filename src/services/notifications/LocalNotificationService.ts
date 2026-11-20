import type { NotificationPayload, NotificationService } from './types';

/** Notificaciones del sistema vía Service Worker (o API Notification como respaldo). */
export class LocalNotificationService implements NotificationService {
  readonly name = 'Notificaciones locales';

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  permission(): NotificationPermission | 'unsupported' {
    return this.isSupported() ? Notification.permission : 'unsupported';
  }

  async requestPermission() {
    if (!this.isSupported()) return 'unsupported' as const;
    return Notification.requestPermission();
  }

  async notify({ title, body, tag }: NotificationPayload): Promise<boolean> {
    if (this.permission() !== 'granted') return false;
    const options: NotificationOptions = { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' };
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      if (reg) await reg.showNotification(title, options);
      else new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }
}
