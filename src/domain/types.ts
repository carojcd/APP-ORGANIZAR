/**
 * Modelo de dominio. Independiente de la interfaz y del almacenamiento:
 * IndexedDB hoy, Supabase mañana, sin cambiar estos tipos.
 */

/** Las categorías son extensibles: el id es un string libre registrado en categories.ts. */
export type CategoryId = string;

export type Priority = 'low' | 'medium' | 'high';
export type ItemStatus = 'pending' | 'in_progress' | 'done';
/** Solo aplica a finanzas: dinero que debo pagar o que me deben. */
export type MoneyDirection = 'pay' | 'collect';

/** Fecha civil en zona America/Bogota con formato ISO "AAAA-MM-DD". */
export type DateKey = string;
/** Hora local "HH:mm" (24 h internamente; se muestra en 12 h). */
export type TimeKey = string;

export interface Reminder {
  enabled: boolean;
  /** Minutos antes de la fecha/hora del registro. 0 = en el momento. */
  minutesBefore: number;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  categoryId: CategoryId;
  /** Fecha del evento o actividad. null = sin fecha (nunca se inventa). */
  date: DateKey | null;
  time: TimeKey | null;
  priority: Priority;
  status: ItemStatus;
  reminder: Reminder | null;
  /** Valor en COP (entero). */
  amount: number | null;
  direction: MoneyDirection | null;
  /** Fecha límite / vencimiento. */
  dueDate: DateKey | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  source: 'chat' | 'manual' | 'demo';
}

/** Datos necesarios para crear un registro (el repositorio completa el resto). */
export type ItemDraft = Pick<Item, 'title' | 'categoryId'> &
  Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'title' | 'categoryId'>>;

export type ItemPatch = Partial<Omit<Item, 'id' | 'createdAt'>>;

export interface ItemFilter {
  categoryIds?: CategoryId[];
  statuses?: ItemStatus[];
  /** Rango inclusivo sobre la fecha efectiva (date ?? dueDate). */
  from?: DateKey;
  to?: DateKey;
  onlyWithAmount?: boolean;
  text?: string;
}

/* ───────────── Conversaciones ───────────── */

export type ChatRole = 'user' | 'assistant';

/** Resultado verificable de una acción ejecutada (se muestra como tarjeta en el chat). */
export interface ActionOutcome {
  kind: 'created' | 'updated' | 'completed' | 'deleted' | 'listed' | 'duplicate' | 'not_found' | 'error';
  itemIds: string[];
  /** Instantánea del registro al momento de la acción (por si después se elimina). */
  snapshots?: Item[];
  label?: string;
}

export interface QuickReply {
  label: string;
  /** Texto que se envía como mensaje del usuario al tocar la opción. */
  value: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  text: string;
  createdAt: string;
  outcomes?: ActionOutcome[];
  quickReplies?: QuickReply[];
  /** Mensaje generado por el modo demostración. */
  demo?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
