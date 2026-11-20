import { CATEGORIES } from '@/domain/categories';
import { Chip } from '@/components/ui/Chip';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  exclude?: string[];
}

/** Filtro horizontal por categoría (desplazable con el pulgar). */
export function CategoryFilter({ value, onChange, exclude = [] }: Props) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <Chip active={value === null} onClick={() => onChange(null)}>
        Todas
      </Chip>
      {CATEGORIES.filter((c) => !exclude.includes(c.id)).map((c) => (
        <Chip
          key={c.id}
          cat={c.id}
          active={value === c.id}
          onClick={() => onChange(value === c.id ? null : c.id)}
          icon={<CategoryIcon categoryId={c.id} size={15} />}
        >
          {c.label}
        </Chip>
      ))}
    </div>
  );
}
