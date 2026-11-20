import { useCallback, useEffect, useState } from 'react';

export type Route = 'home' | 'chat' | 'agenda' | 'tasks' | 'finance';
const ROUTES: Route[] = ['home', 'chat', 'agenda', 'tasks', 'finance'];

function read(): Route {
  const r = window.location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(r) ? r : 'home';
}

/** Navegación por hash: funciona con el botón "atrás" de Android sin router externo. */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((next: Route) => {
    if (next === read()) return;
    window.location.hash = `/${next}`;
  }, []);
  return { route, navigate };
}
