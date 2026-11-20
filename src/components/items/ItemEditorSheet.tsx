/**
 * Formulario para crear y editar registros manualmente.
 * Valida con las mismas reglas del dominio y previene duplicados.
 */
import { useEffect, useState } from 'react';
import { Bell, Check, RotateCcw, Trash2 } from 'lucide-react';
import { CATEGORIES } from '@/domain/categories';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/domain/labels';
import type { Item, ItemDraft, ItemStatus, MoneyDirection, Priority } from '@/domain/types';
import { validateItemFields } from '@/domain/validation';
import { formatDate, formatThousands } from '@/lib/format';
import { todayKey } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { useApp } from '@/state/AppContext';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';

interface FormState {
  title: string;
  description: string;
  categoryId: string;
  date: string;
  time: string;
  dueDate: string;
  priority: Priority;
  status: ItemStatus;
  amount: string;
  direction: MoneyDirection;
  reminderOn: boolean;
  reminderMinutes: number;
}

const REMINDER_OPTIONS = [
  { value: 0, label: 'En el momento' },
  { value: 15, label: '15 min antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 día antes' },
];

function toForm(item: Item | null, defaults?: Partial<ItemDraft>): FormState {
  const src = item ?? defaults ?? {};
  return {
    title: src.title ?? '',
    description: src.description ?? '',
    categoryId: src.categoryId ?? 'personal',
    date: src.date ?? '',
    time: src.time ?? '',
    dueDate: src.dueDate ?? '',
    priority: src.priority ?? 'medium',
    status: src.status ?? 'pending',
    amount: src.amount != null ? formatThousands(src.amount) : '',
    direction: src.direction ?? 'pay',
    reminderOn: Boolean(src.reminder?.enabled),
    reminderMinutes: src.reminder?.minutesBefore ?? 15,
  };
}

function parseAmount(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

export function ItemEditorSheet() {
  const { editor, closeEditor, createItem, updateItem, deleteItem, storage } = useApp();
  const { open, item, defaults } = editor;
  const [form, setForm] = useState<FormState>(() => toForm(item, defaults));
  const [errors, setErrors] = useState<string[]>([]);
  const [duplicateWarned, setDuplicateWarned] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(item, defaults));
      setErrors([]);
      setDuplicateWarned(null);
      setConfirmDelete(false);
    }
  }, [open, item, defaults]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const isFinance = form.categoryId === 'finance';

  const buildDraft = (): ItemDraft => {
    const amount = parseAmount(form.amount);
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId,
      date: form.date || null,
      time: form.time || null,
      dueDate: form.dueDate || (isFinance && form.date ? form.date : null),
      priority: form.priority,
      status: form.status,
      amount,
      direction: amount != null && isFinance ? form.direction : null,
      reminder: form.reminderOn ? { enabled: true, minutesBefore: form.reminderMinutes } : null,
    };
  };

  const save = async () => {
    const draft = buildDraft();
    const issues = validateItemFields(draft, { requireTitle: true });
    if (form.reminderOn && !draft.date && !draft.dueDate) issues.push('Para un recordatorio necesitas una fecha.');
    setErrors(issues);
    if (issues.length) return;

    setSaving(true);
    try {
      const duplicate = await storage.items.findDuplicate(draft, item?.id);
      if (duplicate && duplicateWarned !== duplicate.id) {
        setDuplicateWarned(duplicate.id);
        return;
      }
      const ok = item ? await updateItem(item.id, draft) : await createItem({ ...draft, source: 'manual' });
      if (ok) closeEditor();
    } finally {
      setSaving(false);
    }
  };

  const titleError = errors.find((e) => e.includes('título'));
  const otherErrors = errors.filter((e) => e !== titleError);

  return (
    <Sheet
      open={open}
      onClose={closeEditor}
      title={item ? 'Editar registro' : 'Nuevo registro'}
      footer={
        <div className="flex gap-2">
          {item && (
            confirmDelete ? (
              <Button
                variant="danger"
                onClick={() => {
                  void deleteItem(item);
                  closeEditor();
                }}
              >
                Confirmar
              </Button>
            ) : (
              <Button variant="danger" aria-label="Eliminar" onClick={() => setConfirmDelete(true)} icon={<Trash2 size={18} />} />
            )
          )}
          <Button block onClick={() => void save()} disabled={saving}>
            {duplicateWarned ? 'Guardar de todos modos' : item ? 'Guardar cambios' : 'Crear registro'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <Field label="Título" error={titleError}>
          <TextInput
            autoFocus={!item}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="¿Qué necesitas recordar?"
            maxLength={140}
            enterKeyHint="done"
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-muted">Categoría</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c.id} cat={c.id} active={form.categoryId === c.id} onClick={() => set('categoryId', c.id)} icon={<CategoryIcon categoryId={c.id} size={15} />}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" hint={form.date ? formatDate(form.date) : 'Sin fecha'}>
            <TextInput type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Hora (opcional)">
            <TextInput type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
          </Field>
        </div>

        {isFinance && (
          <div className="space-y-3 rounded-3xl bg-surface-2/60 p-3.5">
            <Segmented
              size="sm"
              value={form.direction}
              onChange={(v) => set('direction', v)}
              options={[
                { value: 'pay', label: 'Por pagar' },
                { value: 'collect', label: 'Por cobrar' },
              ]}
            />
            <Field label="Valor (COP)">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted">$</span>
                <TextInput
                  inputMode="numeric"
                  className="pl-7 font-semibold tabular"
                  value={form.amount}
                  placeholder="0"
                  onChange={(e) => {
                    const n = parseAmount(e.target.value);
                    set('amount', n == null ? '' : formatThousands(n));
                  }}
                />
              </div>
            </Field>
          </div>
        )}

        <Field label="Fecha de vencimiento (opcional)" hint={form.dueDate ? formatDate(form.dueDate) : isFinance ? 'Si la dejas vacía se usa la fecha.' : undefined}>
          <TextInput type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-muted">Prioridad</span>
          <Segmented
            value={form.priority}
            onChange={(v) => set('priority', v)}
            options={(['low', 'medium', 'high'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
          />
        </div>

        {item && (
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Estado</span>
            <Segmented
              value={form.status}
              onChange={(v) => set('status', v)}
              options={(['pending', 'in_progress', 'done'] as ItemStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>
        )}

        <div className="rounded-3xl border border-line p-3.5">
          <button type="button" className="flex w-full items-center justify-between" onClick={() => set('reminderOn', !form.reminderOn)} aria-pressed={form.reminderOn}>
            <span className="flex items-center gap-2.5 text-[15px] font-semibold">
              <Bell size={18} className="text-muted" /> Recordatorio
            </span>
            <span className={cn('relative h-7 w-12 rounded-full transition', form.reminderOn ? 'bg-accent' : 'bg-line')}>
              <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', form.reminderOn ? 'left-6' : 'left-1')} />
            </span>
          </button>
          {form.reminderOn && (
            <div className="mt-3 flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map((o) => (
                <Chip key={o.value} active={form.reminderMinutes === o.value} onClick={() => set('reminderMinutes', o.value)}>
                  {o.label}
                </Chip>
              ))}
              {!form.time && <p className="w-full text-xs text-faint">Sin hora, el recordatorio se calcula desde las 8:00 a. m.</p>}
            </div>
          )}
        </div>

        <Field label="Descripción (opcional)">
          <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Detalles, notas, enlaces…" maxLength={2000} />
        </Field>

        {item && (
          <div className="flex items-center justify-between text-xs text-faint">
            <span>Creado: {formatDate(todayKey(new Date(item.createdAt)))}</span>
            {item.status !== 'done' ? (
              <button className="flex items-center gap-1 font-semibold text-success" onClick={() => set('status', 'done')}>
                <Check size={14} /> Marcar completada
              </button>
            ) : (
              <button className="flex items-center gap-1 font-semibold text-muted" onClick={() => set('status', 'pending')}>
                <RotateCcw size={13} /> Reabrir
              </button>
            )}
          </div>
        )}

        {duplicateWarned && (
          <p className="rounded-2xl bg-warning/10 px-3.5 py-3 text-sm font-medium text-warning">
            Ya existe un registro igual para esa fecha. Revisa antes de guardar para evitar duplicados.
          </p>
        )}
        {otherErrors.length > 0 && (
          <ul className="rounded-2xl bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">
            {otherErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
