import { Briefcase, Palette, Tag, User, Wallet, type LucideProps } from 'lucide-react';
import { getCategory } from '@/domain/categories';

const ICONS = { briefcase: Briefcase, palette: Palette, user: User, wallet: Wallet, tag: Tag };

export function CategoryIcon({ categoryId, ...props }: { categoryId: string } & LucideProps) {
  const Icon = ICONS[getCategory(categoryId).icon] ?? Tag;
  return <Icon {...props} />;
}

/** Ícono de categoría dentro de un círculo tintado. */
export function CategoryBadge({ categoryId, size = 36 }: { categoryId: string; size?: number }) {
  return (
    <span
      data-cat={categoryId}
      className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[var(--c-soft)] text-[var(--c)]"
      style={{ width: size, height: size }}
    >
      <CategoryIcon categoryId={categoryId} size={size * 0.48} strokeWidth={2.2} />
    </span>
  );
}
