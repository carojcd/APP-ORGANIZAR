/**
 * Datos de demostración, generados relativos a "hoy" para que la app
 * siempre se vea viva. Se marcan con source: 'demo'.
 */
import { buildItem } from '@/domain/items';
import type { Item, ItemDraft } from '@/domain/types';
import { addDays, endOfMonth, todayKey } from '@/lib/dates';
import type { StorageProvider } from '../storage/types';

const SEEDED_KEY = 'demo-seeded-v1';

export function buildDemoItems(today = todayKey()): Item[] {
  const d = (n: number) => addDays(today, n);
  const drafts: ItemDraft[] = [
    { title: 'Responder correos del equipo', categoryId: 'work', date: d(0), time: '08:30', status: 'done' },
    { title: 'Revisar pendientes del trabajo', categoryId: 'work', date: d(0), time: '11:00', priority: 'high' },
    { title: 'Comité de proyecto', categoryId: 'work', date: d(0), time: '15:00', reminder: { enabled: true, minutesBefore: 15 } },
    { title: 'Reunión con Don Vitto', categoryId: 'work', date: d(1), time: '09:00', reminder: { enabled: true, minutesBefore: 15 } },
    { title: 'Informe mensual de resultados', categoryId: 'work', date: d(4), dueDate: d(4), priority: 'high' },
    { title: 'Entrega de piezas para FLM', description: 'Tres piezas para redes sociales.', categoryId: 'freelance', date: d(2), dueDate: d(2), priority: 'high' },
    { title: 'Propuesta de branding para Café Origen', categoryId: 'freelance', date: d(5), dueDate: d(5) },
    { title: 'Cobrar anticipo a Estudio Norte', categoryId: 'finance', date: d(6), dueDate: d(6), amount: 1_800_000, direction: 'collect' },
    { title: 'Pagar tarjeta de crédito', categoryId: 'finance', date: d(-2), dueDate: d(-2), amount: 280_000, priority: 'high' },
    { title: 'Servicios públicos', categoryId: 'finance', date: d(3), dueDate: d(3), amount: 350_000, reminder: { enabled: true, minutesBefore: 1440 } },
    { title: 'Pagar Falabella', categoryId: 'finance', date: d(7), dueDate: d(7), amount: 420_000 },
    { title: 'Arriendo', categoryId: 'finance', date: endOfMonth(today), dueDate: endOfMonth(today), amount: 1_600_000 },
    { title: 'Plan de celular', categoryId: 'finance', date: d(-5), dueDate: d(-5), amount: 65_000, status: 'done' },
    { title: 'Comprar mercado', categoryId: 'personal', date: d(0), time: '18:30' },
    { title: 'Cita con el odontólogo', categoryId: 'personal', date: d(4), time: '10:30', reminder: { enabled: true, minutesBefore: 60 } },
    { title: 'Cumpleaños de mamá', categoryId: 'personal', date: d(9), priority: 'high' },
    { title: 'Renovar el pasaporte', categoryId: 'personal', priority: 'low' },
  ];
  const base = Date.now() - 86_400_000;
  return drafts.map((draft, i) => buildItem({ ...draft, source: 'demo' }, new Date(base + i * 1000)));
}

let seeding: Promise<boolean> | null = null;

/** Siembra los datos solo la primera vez (seguro ante llamadas simultáneas). */
export function ensureDemoData(storage: StorageProvider): Promise<boolean> {
  seeding ??= (async () => {
    const seeded = await storage.meta.get<boolean>(SEEDED_KEY);
    if (seeded) return false;
    await storage.meta.set(SEEDED_KEY, true);
    await storage.items.bulkPut(buildDemoItems());
    return true;
  })().catch((error) => {
    seeding = null;
    throw error;
  });
  return seeding;
}

export async function resetDemoData(storage: StorageProvider): Promise<void> {
  await storage.items.clear();
  await storage.items.bulkPut(buildDemoItems());
  await storage.meta.set(SEEDED_KEY, true);
}
