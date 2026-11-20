import { useState } from 'react';
import { Bell, Database, Download, Monitor, Moon, RotateCcw, Sparkles, Sun, Trash2 } from 'lucide-react';
import { LOCALE } from '@/config/locale';
import { cn } from '@/lib/cn';
import { resetDemoData } from '@/services/demo/seed';
import { useApp, type ThemeMode } from '@/state/AppContext';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

function Row({ icon, title, text, children }: { icon: React.ReactNode; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{title}</p>
        {text && <p className="text-[13px] text-muted">{text}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setTheme, storage, assistant, aiNotice, toast, notificationPermission, enableNotifications, canInstall, install } = useApp();
  const [confirm, setConfirm] = useState<null | 'reset' | 'wipe'>(null);
  const provider = assistant.provider;

  const run = async (kind: 'reset' | 'wipe' | 'chats') => {
    try {
      if (kind === 'reset') await resetDemoData(storage);
      if (kind === 'wipe') {
        await storage.items.clear();
        await storage.conversations.clear();
      }
      if (kind === 'chats') await storage.conversations.clear();
      toast(kind === 'reset' ? 'Datos de demostración restaurados' : kind === 'wipe' ? 'Todos los datos fueron borrados' : 'Historial borrado');
    } catch {
      toast('No se pudo completar la acción', { tone: 'error' });
    }
    setConfirm(null);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Configuración">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Apariencia</p>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-sm font-semibold transition',
              theme === value ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg',
            )}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs font-bold uppercase tracking-wide text-faint">General</p>
      <div className="divide-y divide-line">
        <Row
          icon={<Sparkles size={19} />}
          title="Inteligencia artificial"
          text={
            provider.isDemo
              ? aiNotice ?? 'Modo demostración. Para usar Gemini agrega GEMINI_API_KEY en .env.local y reinicia "npm run dev".'
              : `${provider.label}. Si falla, se usa el modo demostración.`
          }
        />
        <Row
          icon={<Bell size={19} />}
          title="Recordatorios"
          text={
            notificationPermission === 'granted'
              ? 'Activos mientras la app esté abierta.'
              : notificationPermission === 'unsupported'
                ? 'Este navegador no soporta notificaciones.'
                : 'Permite notificaciones para recibir avisos.'
          }
        >
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <Button size="sm" variant="secondary" onClick={() => void enableNotifications()}>Activar</Button>
          )}
        </Row>
        <Row icon={<Database size={19} />} title="Almacenamiento" text={`${storage.name}. Tus datos se quedan en este dispositivo.`} />
        {canInstall && (
          <Row icon={<Download size={19} />} title="Instalar aplicación" text="Agrégala a tu pantalla de inicio.">
            <Button size="sm" onClick={() => void install()}>Instalar</Button>
          </Row>
        )}
      </div>

      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-faint">Datos</p>
      <div className="space-y-2">
        <Button block variant="secondary" icon={<RotateCcw size={17} />} onClick={() => (confirm === 'reset' ? void run('reset') : setConfirm('reset'))}>
          {confirm === 'reset' ? 'Toca de nuevo para confirmar' : 'Restaurar datos de demostración'}
        </Button>
        <Button block variant="secondary" onClick={() => void run('chats')}>Borrar historial de conversaciones</Button>
        <Button block variant="danger" icon={<Trash2 size={17} />} onClick={() => (confirm === 'wipe' ? void run('wipe') : setConfirm('wipe'))}>
          {confirm === 'wipe' ? 'Toca de nuevo para borrar todo' : 'Borrar todos los datos'}
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-faint">
        Mi Asistente v0.1 · {LOCALE.language} · {LOCALE.timeZone} · {LOCALE.currency}
      </p>
    </Sheet>
  );
}
