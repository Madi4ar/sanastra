import type { Discount, PaymentPlan, SubscriptionOperation } from '@/api/types';
import { formatNumber } from './format';

/** Размер скидки в KZT (процент округляется до тенге). */
export function discountAmount(basePrice: number, discount: Discount): number {
  if (discount.type === 'PERCENT') return Math.round((basePrice * discount.value) / 100);
  return discount.value;
}

/** Итоговая годовая цена = max(0, Базовая годовая цена тарифа − Ручная скидка) */
export function finalPrice(basePrice: number, discount: Discount): number {
  return Math.max(0, basePrice - discountAmount(basePrice, discount));
}

export const formatKzt = (v: number) => `${formatNumber(v)} ₸`;

export function formatDiscount(d: Discount): string {
  if (!d.value) return '—';
  return d.type === 'PERCENT' ? `${formatNumber(d.value)} %` : formatKzt(d.value);
}

export const NO_DISCOUNT: Discount = { type: 'AMOUNT', value: 0 };

export const OPERATION_LABEL: Record<SubscriptionOperation, string> = {
  ACTIVATION: 'Активация',
  RENEWAL: 'Продление',
  TARIFF_CHANGE: 'Смена тарифа',
  UPDATE: 'Изменение условий',
  PAYMENT: 'Оплата месяцев',
};

/** Сумма к оплате за выбранные месяцы. Последний платёж закрывает остаток, чтобы итог за год совпал с годовой ценой. */
export function planAmount(plan: Pick<PaymentPlan, 'months' | 'monthlyAmount' | 'annualAmount' | 'paidAmount'>, count: number): number {
  const unpaid = plan.months.filter((m) => !m.paid).length;
  return count >= unpaid ? Math.max(0, plan.annualAmount - plan.paidAmount) : plan.monthlyAmount * count;
}
