/**
 * График оплаты подписки: годовой период делится на 12 месяцев, у каждого свой статус.
 * Срок подписки следует из оплаченных месяцев: доступ действует, пока оплачен текущий месяц и идущие за ним подряд.
 * Период, оформленный суперадминистратором, считается оплаченным целиком.
 */
import dayjs from 'dayjs';
import type { PaymentMonth, PaymentPlan } from '@/api/types';
import { API_DATE } from '@/shared/format';
import type { OrgRecord } from './db';

export interface StoredSchedule {
  tariffPlanId: string;
  startDate: string;
  monthlyAmount: number;
  annualAmount: number;
  months: { from: string; to: string; paidAt: string | null; amount: number | null }[];
}

const today = () => dayjs().format(API_DATE);

function monthRange(start: string, i: number) {
  const s = dayjs(start);
  return {
    from: s.add(i, 'month').format(API_DATE),
    to: s.add(i + 1, 'month').subtract(1, 'day').format(API_DATE),
  };
}

export function newSchedule(tariffPlanId: string, startDate: string, annualAmount: number, monthlyAmount: number): StoredSchedule {
  return {
    tariffPlanId,
    startDate,
    annualAmount,
    monthlyAmount,
    months: Array.from({ length: 12 }, (_, i) => ({ ...monthRange(startDate, i), paidAt: null, amount: null })),
  };
}

function toMonths(s: StoredSchedule): PaymentMonth[] {
  const now = today();
  return s.months.map((m, index) => ({
    index,
    from: m.from,
    to: m.to,
    paid: m.paidAt !== null,
    paidAt: m.paidAt,
    amount: m.amount,
    current: m.from <= now && now <= m.to,
  }));
}

const toPlan = (s: StoredSchedule, continuing: boolean): PaymentPlan => ({
  continuing,
  startDate: s.startDate,
  monthlyAmount: s.monthlyAmount,
  annualAmount: s.annualAmount,
  paidAmount: s.months.reduce((n, m) => n + (m.amount ?? 0), 0),
  months: toMonths(s),
});

/** Месяцы текущей подписки. Без сохранённого графика период считается оплаченным суперадминистратором. */
export function currentMonths(org: OrgRecord): PaymentMonth[] {
  if (org.paymentSchedule) return toMonths(org.paymentSchedule);
  const now = today();
  const months: PaymentMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const { from, to } = monthRange(org.subscriptionStartDate, i);
    if (from > org.subscriptionEndDate) break;
    const end = to < org.subscriptionEndDate ? to : org.subscriptionEndDate;
    months.push({ index: i, from, to: end, paid: true, paidAt: null, amount: null, current: from <= now && now <= end });
  }
  return months;
}

/** Есть неоплаченные месяцы, которые ещё не прошли: оплата продолжает текущий график */
export function canContinue(org: OrgRecord, tariffPlanId: string): boolean {
  const s = org.paymentSchedule;
  return Boolean(s && s.tariffPlanId === tariffPlanId && s.months.some((m) => m.paidAt === null && m.to >= today()));
}

/** С какой даты начнётся новый годовой период: продление — после окончания текущего, иначе с сегодняшнего дня */
export function nextPeriodStart(org: OrgRecord, tariffPlanId: string): string {
  const expired = org.subscriptionEndDate < today();
  if (expired || tariffPlanId !== org.tariffPlanId) return today();
  const scheduleEnd = org.paymentSchedule?.months.at(-1)?.to;
  const end = scheduleEnd && scheduleEnd > org.subscriptionEndDate ? scheduleEnd : org.subscriptionEndDate;
  return dayjs(end).add(1, 'day').format(API_DATE);
}

/** План оплаты для тарифа: продолжение текущего графика или новый год с указанными ценами */
export function planFor(org: OrgRecord, tariffPlanId: string, annualAmount: number, monthlyAmount: number): PaymentPlan {
  if (canContinue(org, tariffPlanId)) return toPlan(org.paymentSchedule!, true);
  return toPlan(newSchedule(tariffPlanId, nextPeriodStart(org, tariffPlanId), annualAmount, monthlyAmount), false);
}

/** Отмечает месяцы оплаченными: сумма распределяется так, чтобы итог за год совпал с годовой ценой */
export function markPaid(s: StoredSchedule, indices: number[], amount: number) {
  const at = new Date().toISOString();
  const share = Math.floor(amount / indices.length);
  indices.forEach((i, n) => {
    const month = s.months[i]!;
    month.paidAt = at;
    month.amount = n === indices.length - 1 ? amount - share * (indices.length - 1) : share;
  });
}

/**
 * Дата окончания доступа по графику: конец непрерывной цепочки оплаченных месяцев от сегодняшнего дня
 * или от начала графика. Если текущий месяц не оплачен, доступ заканчивается накануне него.
 */
export function scheduleEndDate(s: StoredSchedule): string {
  const cursor = today() > s.startDate ? today() : s.startDate;
  const i = s.months.findIndex((m) => m.from <= cursor && cursor <= m.to);
  if (i < 0) {
    const paid = s.months.filter((m) => m.paidAt);
    return paid.at(-1)?.to ?? dayjs(s.startDate).subtract(1, 'day').format(API_DATE);
  }
  if (!s.months[i]!.paidAt) return dayjs(s.months[i]!.from).subtract(1, 'day').format(API_DATE);
  let last = i;
  while (s.months[last + 1]?.paidAt) last += 1;
  return s.months[last]!.to;
}
