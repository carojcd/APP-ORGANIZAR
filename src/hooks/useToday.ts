import { useEffect, useState } from 'react';
import { todayKey } from '@/lib/dates';

/** Fecha de hoy en Bogotá; se actualiza al cruzar la medianoche. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayKey());
  useEffect(() => {
    const id = setInterval(() => setToday((prev) => {
      const next = todayKey();
      return next === prev ? prev : next;
    }), 30_000);
    return () => clearInterval(id);
  }, []);
  return today;
}
