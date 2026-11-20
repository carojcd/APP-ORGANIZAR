import { describe, expect, it } from 'vitest';
import { buildItem, compareItems, isDuplicateOf, matchesFilter } from '@/domain/items';
import { assertValidDraft } from '@/domain/validation';
import type { Item, ItemDraft, ItemFilter, ItemPatch } from '@/domain/types';
import type { ItemRepository } from '../storage/types';
import { interpretDemo } from '../ai/demo/DemoProvider';
import type { PendingIntent } from '../ai/types';
import { ActionExecutor } from './ActionExecutor';

/** Repositorio en memoria que respeta el mismo contrato que IndexedDB. */
class MemoryRepo implements ItemRepository {
  items: Item[] = [];
  async list(f?: ItemFilter) { return this.items.filter((i) => matchesFilter(i, f)).sort(compareItems); }
  async get(id: string) { return this.items.find((i) => i.id === id) ?? null; }
  async create(d: ItemDraft) { assertValidDraft(d); const i = buildItem(d); this.items.push(i); return i; }
  async update(id: string, p: ItemPatch) {
    const i = this.items.findIndex((x) => x.id === id);
    this.items[i] = { ...this.items[i], ...p };
    return this.items[i];
  }
  async remove(id: string) { this.items = this.items.filter((i) => i.id !== id); }
  async findDuplicate(d: ItemDraft) { return this.items.find((i) => isDuplicateOf(i, d)) ?? null; }
  async bulkPut(list: Item[]) { this.items.push(...list); }
  async clear() { this.items = []; }
}

const today = '2026-11-20';

function setup() {
  const repo = new MemoryRepo();
  const exec = new ActionExecutor({ items: repo, today });
  let pending: PendingIntent | null = null;
  const say = async (text: string) => {
    const r = await exec.execute(interpretDemo(text, { today, pending }).actions);
    pending = r.pending;
    return r;
  };
  return { repo, say };
}

describe('flujo completo chat → acciones → almacenamiento', () => {
  it('crea, consulta, modifica, completa y elimina', async () => {
    const { repo, say } = setup();

    let r = await say('Mañana tengo una reunión con Don Vitto a las 9 de la mañana.');
    expect(r.outcomes[0].kind).toBe('created');
    expect(r.text).toContain('21/11/2026');
    expect(r.text).not.toContain('..');

    r = await say('Mañana tengo una reunión con Don Vitto a las 9 de la mañana.');
    expect(r.outcomes[0].kind).toBe('duplicate');
    expect(repo.items).toHaveLength(1);

    r = await say('Cambia la reunión de mañana para las 3 de la tarde.');
    expect(r.outcomes[0].kind).toBe('updated');
    expect(repo.items[0].time).toBe('15:00');

    await say('Tengo que entregar las piezas de FLM hoy');
    r = await say('Marca como completada la entrega de FLM.');
    expect(r.outcomes[0].kind).toBe('completed');

    await say('Agrega un pago de servicios públicos por $350.000 hoy');
    r = await say('¿Qué pagos tengo pendientes este mes?');
    expect(r.text).toContain('350.000');

    r = await say('Elimina la reunión con Don Vitto');
    expect(r.outcomes[0].kind).toBe('deleted');
    expect(repo.items.find((i) => i.title.includes('Vitto'))).toBeUndefined();
  });

  it('no inventa: informa cuando no encuentra el registro', async () => {
    const { repo, say } = setup();
    const r = await say('Marca como completada la entrega de FLM');
    expect(r.outcomes[0].kind).toBe('not_found');
    expect(r.text).toContain('No hice ningún cambio');
    expect(repo.items).toHaveLength(0);
  });

  it('pregunta cuál cuando hay varios candidatos y luego actúa', async () => {
    const { repo, say } = setup();
    await say('Mañana reunión con ventas a las 10 de la mañana');
    await say('Mañana reunión con diseño a las 11 de la mañana');
    let r = await say('Cambia la reunión de mañana para las 4 de la tarde');
    expect(r.pending?.missing).toBe('target');
    r = await say('2');
    expect(r.outcomes[0].kind).toBe('updated');
    expect(repo.items.find((i) => i.title.includes('diseño'))?.time).toBe('16:00');
    expect(repo.items.find((i) => i.title.includes('ventas'))?.time).toBe('10:00');
  });
});
