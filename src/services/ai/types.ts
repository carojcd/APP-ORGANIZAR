/**
 * Contrato entre la interfaz y cualquier proveedor de IA.
 *
 * Un proveedor SOLO interpreta: recibe el texto del usuario y devuelve
 * acciones estructuradas (JSON). Nunca escribe en la base de datos ni
 * redacta confirmaciones de guardado: eso lo hace el ActionExecutor
 * después de ejecutar realmente cada acción.
 */
import type {
  CategoryId,
  DateKey,
  Item,
  ItemStatus,
  MoneyDirection,
  Priority,
  QuickReply,
  TimeKey,
} from '@/domain/types';

/** Campos que la IA puede proponer para un registro nuevo. */
export interface ActionItemDraft {
  title: string;
  description?: string;
  categoryId: CategoryId;
  date?: DateKey | null;
  time?: TimeKey | null;
  priority?: Priority;
  reminderMinutesBefore?: number | null;
  amount?: number | null;
  direction?: MoneyDirection | null;
  dueDate?: DateKey | null;
}

export type ActionItemChanges = Partial<Omit<ActionItemDraft, 'categoryId'>> & {
  categoryId?: CategoryId;
  status?: ItemStatus;
};

/** Cómo identificar un registro existente ("la reunión de mañana"). */
export interface ItemTarget {
  /** Id exacto, cuando se conoce (p. ej. tras una aclaración). */
  id?: string;
  /** Texto descriptivo para buscar por similitud. */
  text?: string;
  categoryId?: CategoryId;
  date?: DateKey;
}

export interface ItemQuery {
  from?: DateKey;
  to?: DateKey;
  categoryIds?: CategoryId[];
  statuses?: ItemStatus[];
  onlyWithAmount?: boolean;
  direction?: MoneyDirection;
  /** Etiqueta humana del periodo ("hoy", "este mes"). */
  label?: string;
}

export type AssistantAction =
  | { type: 'create_item'; item: ActionItemDraft }
  | { type: 'update_item'; target: ItemTarget; changes: ActionItemChanges }
  | { type: 'complete_item'; target: ItemTarget }
  | { type: 'delete_item'; target: ItemTarget }
  | { type: 'query_items'; query: ItemQuery }
  | { type: 'clarify'; question: string; options?: QuickReply[]; pending: PendingIntent }
  | { type: 'reply'; text: string };

/** Acción que espera un dato del usuario para completarse. Serializable. */
export interface PendingIntent {
  action: Extract<AssistantAction, { type: 'create_item' | 'update_item' | 'complete_item' | 'delete_item' }>;
  missing: 'date' | 'meridiem' | 'target';
  /** Para 'meridiem': hora (1-12) y minutos a la espera de a. m./p. m. */
  hour?: number;
  minute?: number;
  /** Si después de la fecha también falta a. m./p. m. */
  thenMeridiem?: { hour: number; minute: number };
  /** Para 'target': candidatos ofrecidos, en orden. */
  candidates?: { id: string; title: string }[];
}

export interface Interpretation {
  actions: AssistantAction[];
}

/** Lo que el proveedor sabe del mundo al interpretar. */
export interface InterpretContext {
  /** Instante actual en ISO. */
  now: string;
  /** Fecha actual en America/Bogota. */
  today: DateKey;
  timeZone: string;
  locale: string;
  pending: PendingIntent | null;
  /** Resumen de registros abiertos para resolver referencias. */
  openItems: Pick<Item, 'id' | 'title' | 'categoryId' | 'date' | 'time' | 'status' | 'amount'>[];
  categories: { id: CategoryId; label: string; description: string }[];
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  /** true si las respuestas provienen del intérprete local de demostración. */
  readonly isDemo: boolean;
  interpret(message: string, context: InterpretContext): Promise<Interpretation>;
}
