import dayjs from 'dayjs';
import type { ChangeSource } from '@/api/types';

export const UI_DATE = 'DD.MM.YYYY';
export const API_DATE = 'YYYY-MM-DD';

export const formatDate = (v?: string | null) => (v ? dayjs(v).format(UI_DATE) : '—');
export const formatDateTime = (v?: string | null) => (v ? dayjs(v).format('DD.MM.YYYY, HH:mm') : '—');
export const todayIso = () => dayjs().format(API_DATE);

export const SOURCE_LABEL: Record<ChangeSource, string> = {
  SUPERADMIN: 'суперадминистратор',
  SYSTEM_PAYMENT: 'платёжный сервис',
  SYSTEM_SCHEDULER: 'планировщик',
};

export function formatNumber(v: number) {
  return new Intl.NumberFormat('ru-RU').format(v);
}
