/**
 * Estado global de la aplicación. Conecta la interfaz con los servicios
 * (almacenamiento, asistente, notificaciones) a través de sus interfaces,
 * nunca de implementaciones concretas.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item, ItemDraft, ItemPatch } from '@/domain/types';
import { useHashRoute, type Route } from '@/hooks/useHashRoute';
import { useToday } from '@/hooks/useToday';
import { toUserMessage } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { initAIProvider } from '@/services/ai';
import { AssistantService } from '@/services/assistant/AssistantService';
import { ensureDemoData } from '@/services/demo/seed';
import { LocalNotificationService } from '@/services/notifications/LocalNotificationService';
import { dueReminders } from '@/services/notifications/reminders';
import { getStorage, type AuthUser, type StorageProvider } from '@/services/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ToastData {
  id: number;
  message: string;
  tone?: 'default' | 'error';
  action?: { label: string; run: () => void };
}

export interface EditorState {
  open: boolean;
  item: Item | null;
  defaults?: Partial<ItemDraft>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface AppContextValue {
  ready: boolean;
  fatalError: string | null;
  storage: StorageProvider;
  assistant: AssistantService;
  /** undefined = comprobando; null = sin sesión (solo en modo nube). */
  authUser: AuthUser | null | undefined;
  signOut: () => Promise<void>;
  /** Por qué Gemini no está activo (clave inválida, etc.), si aplica. */
  aiNotice?: string;
  items: Item[];
  today: string;
  route: Route;
  navigate: (r: Route) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  editor: EditorState;
  openEditor: (item?: Item | null, defaults?: Partial<ItemDraft>) => void;
  closeEditor: () => void;
  toast: (message: string, opts?: Omit<ToastData, 'id' | 'message'>) => void;
  toasts: ToastData[];
  dismissToast: (id: number) => void;
  createItem: (draft: ItemDraft) => Promise<Item | null>;
  updateItem: (id: string, patch: ItemPatch) => Promise<Item | null>;
  deleteItem: (item: Item) => Promise<void>;
  toggleDone: (item: Item) => Promise<void>;
  restoreItems: (items: Item[]) => Promise<void>;
  voiceRequested: boolean;
  requestVoice: () => void;
  consumeVoiceRequest: () => void;
  notifications: LocalNotificationService;
  notificationPermission: NotificationPermission | 'unsupported';
  enableNotifications: () => Promise<void>;
  canInstall: boolean;
  install: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const SENT_KEY = 'reminders-sent';

function readTheme(): ThemeMode {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const storage = useMemo(() => getStorage(), []);
  const notifications = useMemo(() => new LocalNotificationService(), []);
  const today = useToday();
  const { route, navigate } = useHashRoute();

  const [ready, setReady] = useState(false);
  const [assistant, setAssistant] = useState<AssistantService | null>(null);
  const [aiNotice, setAiNotice] = useState<string | undefined>();
  const [authUser, setAuthUser] = useState<AuthUser | null | undefined>(storage.auth ? undefined : null);
  const needsLogin = Boolean(storage.auth);
  const canLoad = !needsLogin || Boolean(authUser);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [theme, setThemeState] = useState<ThemeMode>(readTheme);
  const [editor, setEditor] = useState<EditorState>({ open: false, item: null });
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [voiceRequested, setVoiceRequested] = useState(false);
  const [notificationPermission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => notifications.permission());
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const toastId = useRef(0);

  /* ── Carga inicial y suscripción a cambios ── */
  const refresh = useCallback(async () => {
    setItems(await storage.items.list());
  }, [storage]);

  /* ── Sesión (solo en modo nube) ── */
  useEffect(() => {
    if (!storage.auth) return;
    let active = true;
    storage.auth.getUser().then((u) => active && setAuthUser(u)).catch(() => active && setAuthUser(null));
    const off = storage.auth.onChange((u) => setAuthUser(u));
    return () => {
      active = false;
      off();
    };
  }, [storage]);

  useEffect(() => {
    if (!canLoad) {
      setItems([]);
      setReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [ai] = await Promise.all([
          initAIProvider(),
          // Los datos de demostración solo se siembran en modo local.
          storage.kind === 'local' ? ensureDemoData(storage) : Promise.resolve(false),
        ]);
        if (cancelled) return;
        setAssistant(new AssistantService(storage, ai.provider));
        setAiNotice(ai.notice);
        await refresh();
        if (!cancelled) setReady(true);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setFatalError(
            storage.kind === 'cloud'
              ? toUserMessage(error)
              : 'No se pudo abrir el almacenamiento local del navegador. ' + toUserMessage(error),
          );
        }
      }
    })();
    const unsubscribe = storage.subscribe((c) => {
      if (c.scope === 'items') void refresh().catch(() => undefined);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [storage, refresh, canLoad]);

  const signOut = useCallback(async () => {
    await storage.auth?.signOut();
    setAuthUser(null);
  }, [storage]);

  /* ── Tema ── */
  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    try {
      localStorage.setItem('theme', t);
    } catch { /* almacenamiento no disponible */ }
  }, []);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        m.setAttribute('content', dark ? '#0d0d10' : '#f6f6f3');
      });
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  /* ── Toasts ── */
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message: string, opts: Omit<ToastData, 'id' | 'message'> = {}) => {
      const id = ++toastId.current;
      setToasts((t) => [...t.slice(-2), { id, message, ...opts }]);
      setTimeout(() => dismissToast(id), opts.action ? 5500 : 3200);
    },
    [dismissToast],
  );

  /* ── Operaciones sobre registros (con manejo de errores) ── */
  const createItem = useCallback(
    async (draft: ItemDraft) => {
      try {
        const item = await storage.items.create(draft);
        toast('Registro guardado');
        return item;
      } catch (error) {
        toast(toUserMessage(error), { tone: 'error' });
        return null;
      }
    },
    [storage, toast],
  );

  const updateItem = useCallback(
    async (id: string, patch: ItemPatch) => {
      try {
        return await storage.items.update(id, patch);
      } catch (error) {
        toast(toUserMessage(error), { tone: 'error' });
        return null;
      }
    },
    [storage, toast],
  );

  const restoreItems = useCallback(
    async (list: Item[]) => {
      try {
        await storage.items.bulkPut(list);
      } catch (error) {
        toast(toUserMessage(error), { tone: 'error' });
      }
    },
    [storage, toast],
  );

  const deleteItem = useCallback(
    async (item: Item) => {
      try {
        await storage.items.remove(item.id);
        toast(`Eliminado «${item.title}»`, { action: { label: 'Deshacer', run: () => void restoreItems([item]) } });
      } catch (error) {
        toast(toUserMessage(error), { tone: 'error' });
      }
    },
    [storage, toast, restoreItems],
  );

  const toggleDone = useCallback(
    async (item: Item) => {
      const next = item.status === 'done' ? 'pending' : 'done';
      const updated = await updateItem(item.id, { status: next });
      if (updated && next === 'done') {
        toast('¡Completada!', { action: { label: 'Deshacer', run: () => void updateItem(item.id, { status: item.status }) } });
      }
    },
    [updateItem, toast],
  );

  /* ── Editor ── */
  const openEditor = useCallback((item: Item | null = null, defaults?: Partial<ItemDraft>) => {
    setEditor({ open: true, item, defaults });
  }, []);
  const closeEditor = useCallback(() => setEditor((e) => ({ ...e, open: false })), []);

  /* ── Recordatorios locales (con la app abierta) ── */
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      let sent: Set<string>;
      try {
        sent = new Set(JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]') as string[]);
      } catch {
        sent = new Set();
      }
      const due = dueReminders(items, new Date(), sent);
      if (!due.length) return;
      for (const { item, key } of due) {
        sent.add(key);
        const body = item.time ? `Hoy a las ${formatTime(item.time)}` : 'Programado para hoy';
        void notifications.notify({ title: `⏰ ${item.title}`, body, tag: item.id });
        toast(`Recordatorio: ${item.title}`);
      }
      try {
        localStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-300)));
      } catch { /* sin almacenamiento */ }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [ready, items, notifications, toast]);

  const enableNotifications = useCallback(async () => {
    const result = await notifications.requestPermission();
    setPermission(result);
    if (result === 'granted') toast('Notificaciones activadas');
    else if (result === 'denied') toast('Permiso de notificaciones denegado', { tone: 'error' });
    else if (result === 'unsupported') toast('Este navegador no soporta notificaciones', { tone: 'error' });
  }, [notifications, toast]);

  /* ── Instalación PWA ── */
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }, [installEvent]);

  const value: AppContextValue = {
    ready: ready && assistant !== null, fatalError, storage,
    // La UI solo se monta cuando `ready` es true, así que assistant ya existe.
    assistant: assistant as AssistantService, aiNotice, authUser, signOut, items, today, route, navigate, theme, setTheme,
    editor, openEditor, closeEditor, toast, toasts, dismissToast,
    createItem, updateItem, deleteItem, toggleDone, restoreItems,
    voiceRequested,
    requestVoice: () => setVoiceRequested(true),
    consumeVoiceRequest: () => setVoiceRequested(false),
    notifications, notificationPermission, enableNotifications,
    canInstall: installEvent !== null, install,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
