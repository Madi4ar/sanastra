import { Button, Checkbox, Input, Radio } from 'antd';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '@/shared/IconButton';
import type { Lang } from './fields';

export function moveItem<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/**
 * Список вариантов с текстом на выбранном языке: варианты ответа, пункты, столбцы.
 * mark: 'single' — один верный (радио), 'multiple' — несколько (флажки).
 */
export function ListEditor<T extends { id: string; ru: string; kz: string; correct?: unknown }>({
  items,
  onChange,
  lang,
  make,
  label,
  addLabel,
  mark,
  min = 1,
  max = 20,
  reorder,
  extra,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  lang: Lang;
  make: () => T;
  /** Подпись поля для i-го элемента (aria) */
  label: (i: number) => string;
  addLabel: string;
  mark?: 'single' | 'multiple';
  min?: number;
  max?: number;
  reorder?: boolean;
  extra?: (item: T, i: number) => ReactNode;
}) {
  const update = (i: number, patch: Partial<T>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          {mark === 'single' && (
            <Radio
              aria-label={`Верный: ${label(i)}`}
              checked={Boolean(item.correct)}
              onChange={() => onChange(items.map((x, j) => ({ ...x, correct: j === i }) as T))}
            />
          )}
          {mark === 'multiple' && (
            <Checkbox
              aria-label={`Верный: ${label(i)}`}
              checked={Boolean(item.correct)}
              onChange={(e) => update(i, { correct: e.target.checked } as Partial<T>)}
            />
          )}
          <Input
            aria-label={label(i)}
            placeholder={lang === 'ru' ? item.kz || label(i) : item.ru || label(i)}
            value={item[lang]}
            onChange={(e) => update(i, { [lang]: e.target.value } as Partial<T>)}
          />
          {extra?.(item, i)}
          {reorder && (
            <>
              <IconButton type="text" size="small" label="Выше" icon={<ArrowUp size={14} />} disabled={i === 0} onClick={() => onChange(moveItem(items, i, -1))} />
              <IconButton
                type="text"
                size="small"
                label="Ниже"
                icon={<ArrowDown size={14} />}
                disabled={i === items.length - 1}
                onClick={() => onChange(moveItem(items, i, 1))}
              />
            </>
          )}
          <IconButton
            type="text"
            danger
            size="small"
            label={`Удалить: ${label(i)}`}
            icon={<Trash2 size={14} />}
            disabled={items.length <= min}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <div>
        <Button size="small" icon={<Plus size={14} />} disabled={items.length >= max} onClick={() => onChange([...items, make()])}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
