import { Tag } from 'antd';

const META: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: 'Активна' },
  BLOCKED: { color: 'red', label: 'Заблокирована' },
  EXPIRED: { color: 'orange', label: 'Истекла' },
};

export const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'ACTIVE', label: 'Активна' },
  { value: 'BLOCKED', label: 'Заблокирована' },
  { value: 'EXPIRED', label: 'Истекла' },
];

/** Статус всегда передаётся текстом, цвет — дополнительный признак. */
export function StatusTag({ status }: { status: string }) {
  const meta = META[status] ?? { color: 'default', label: 'Неизвестно' };
  return (
    <Tag color={meta.color} variant="outlined" data-testid="status-tag">
      {meta.label}
    </Tag>
  );
}
