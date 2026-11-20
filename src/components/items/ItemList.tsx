import type { Item } from '@/domain/types';
import { ItemRow } from './ItemRow';

export function ItemList({ items, hideDate }: { items: Item[]; hideDate?: boolean }) {
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <div key={item.id} className="animate-fade-in">
          <ItemRow item={item} hideDate={hideDate} />
        </div>
      ))}
    </div>
  );
}
