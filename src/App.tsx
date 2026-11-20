import { TriangleAlert } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { Toaster } from '@/components/ui/Toaster';
import { ItemEditorSheet } from '@/components/items/ItemEditorSheet';
import { BottomNav, SideRail } from '@/components/layout/Navigation';
import { AgendaScreen } from '@/features/agenda/AgendaScreen';
import { ChatScreen } from '@/features/chat/ChatScreen';
import { FinanceScreen } from '@/features/finance/FinanceScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { Button } from '@/components/ui/Button';

export default function App() {
  const { ready, fatalError, route, storage, authUser, signOut } = useApp();

  if (fatalError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
        <TriangleAlert size={32} className="text-danger" />
        <p className="max-w-sm font-semibold">{fatalError}</p>
        <p className="text-sm text-muted">
          {storage.kind === 'cloud' ? 'Revisa tu conexión a internet y la configuración de Supabase.' : 'Si usas navegación privada, prueba en una ventana normal.'}
        </p>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" onClick={() => window.location.reload()}>Reintentar</Button>
          {storage.auth && <Button variant="ghost" onClick={() => void signOut().then(() => window.location.reload())}>Cerrar sesión</Button>}
        </div>
      </div>
    );
  }

  if (storage.auth && authUser === null) return <><LoginScreen /><Toaster /></>;

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <img src="/icons/icon.svg" alt="Cargando" className="size-14 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <SideRail />
      <div className="lg:pl-60">
        {route === 'home' && <HomeScreen />}
        {route === 'chat' && <ChatScreen />}
        {route === 'agenda' && <AgendaScreen />}
        {route === 'tasks' && <TasksScreen />}
        {route === 'finance' && <FinanceScreen />}
      </div>
      <BottomNav />
      <ItemEditorSheet />
      <Toaster />
    </>
  );
}
