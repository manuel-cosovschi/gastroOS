'use client';

import { cn } from '@/lib/utils';
import type { Category } from '@/types';

interface CategoryFilterProps {
  categories: Category[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export function CategoryFilter({ categories, selectedSlug, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'rounded-full px-4 py-2 text-sm font-medium transition-colors',
          selectedSlug === null
            ? 'bg-stone-900 text-white'
            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
        )}
      >
        Todos
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.slug)}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
            selectedSlug === cat.slug
              ? 'bg-stone-900 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
