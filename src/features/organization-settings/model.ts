import dayjs from 'dayjs';
import { z } from 'zod';
import type {
  Discount,
  DiscountType,
  OrganizationDetail,
  OverridePolicy,
  SubscriptionSettingsPayload,
  TariffPlanDetail,
} from '@/api/types';
import { API_DATE, formatNumber, todayIso } from '@/shared/format';
import { finalPrice, formatKzt } from '@/shared/pricing';

export interface SettingsFormValues {
  tariffPlanId: string;
  subscriptionEnabled: boolean;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  /** Ручная скидка на годовую цену */
  discountType: DiscountType;
  discountValue: number | null;
  /** null — наследование значения тарифа */
  moduleOverrides: Record<string, boolean | null>;
  /** Срок действия модулей, включённых сверх тарифа (ISO date-time, null — бессрочно) */
  moduleExpirations: Record<string, string | null>;
}

/** Условия тарифа: из текущего периода организации или из справочника (новое назначение / продление). */
export interface TariffDefaults {
  tariffPlanId: string;
  name: string;
  annualPrice: number;
  modules: Record<string, boolean>;
  limits: Record<string, number>;
}

export function toFormValues(org: OrganizationDetail): SettingsFormValues {
  return {
    tariffPlanId: org.tariffPlan.id,
    subscriptionEnabled: org.subscriptionEnabled,
    subscriptionStartDate: org.subscriptionStartDate,
    subscriptionEndDate: org.subscriptionEndDate,
    discountType: org.pricing.discount.type,
    discountValue: org.pricing.discount.value,
    moduleOverrides: Object.fromEntries(org.modules.map((m) => [m.code, m.overrideEnabled])),
    moduleExpirations: Object.fromEntries(org.modules.map((m) => [m.code, m.expiresAt])),
  };
}

export function defaultsFromOrganization(org: OrganizationDetail): TariffDefaults {
  return {
    tariffPlanId: org.tariffPlan.id,
    name: org.tariffPlan.name,
    annualPrice: org.pricing.annualPrice,
    modules: Object.fromEntries(org.modules.map((m) => [m.code, m.tariffEnabled])),
    limits: Object.fromEntries(org.limits.map((l) => [l.code, l.value])),
  };
}

export function defaultsFromTariff(t: TariffPlanDetail): TariffDefaults {
  return {
    tariffPlanId: t.id,
    name: t.name,
    annualPrice: t.annualPrice,
    modules: Object.fromEntries(t.modules.map((m) => [m.code, m.enabled])),
    limits: Object.fromEntries(t.limits.map((l) => [l.code, l.value])),
  };
}

export const discountOf = (v: Pick<SettingsFormValues, 'discountType' | 'discountValue'>): Discount => ({
  type: v.discountType,
  value: v.discountValue ?? 0,
});

/** Модуль включён сверх тарифа — для него задаётся срок действия. */
export const isExtraModule = (code: string, values: SettingsFormValues, d: TariffDefaults) =>
  values.moduleOverrides[code] === true && !d.modules[code];

export function toPayload(
  values: SettingsFormValues,
  version: number,
  defaults: TariffDefaults,
): SubscriptionSettingsPayload {
  return {
    tariffPlanId: values.tariffPlanId,
    subscriptionEnabled: values.subscriptionEnabled,
    subscriptionStartDate: values.subscriptionStartDate!,
    subscriptionEndDate: values.subscriptionEndDate!,
    discount: discountOf(values),
    moduleOverrides: Object.entries(values.moduleOverrides).map(([code, value]) => ({
      code,
      value,
      expiresAt: isExtraModule(code, values, defaults) ? (values.moduleExpirations[code] ?? null) : null,
    })),
    version,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function buildSchema() {
  return z
    .object({
      tariffPlanId: z.string({ error: 'Выберите тарифный план' }).min(1, 'Выберите тарифный план'),
      subscriptionEnabled: z.boolean(),
      subscriptionStartDate: z
        .string()
        .nullable()
        .refine((v) => v !== null && ISO_DATE.test(v), 'Укажите дату начала'),
      subscriptionEndDate: z
        .string()
        .nullable()
        .refine((v) => v !== null && ISO_DATE.test(v), 'Укажите дату окончания'),
      discountType: z.enum(['AMOUNT', 'PERCENT']),
      discountValue: z.number({ error: 'Введите число' }).min(0, 'Скидка не может быть отрицательной').nullable(),
      moduleOverrides: z.record(z.string(), z.boolean().nullable()),
      moduleExpirations: z.record(z.string(), z.string().nullable()),
    })
    .superRefine((v, ctx) => {
      if (v.subscriptionStartDate && v.subscriptionEndDate && v.subscriptionEndDate < v.subscriptionStartDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['subscriptionEndDate'],
          message: 'Дата окончания не может быть раньше даты начала',
        });
      }
      if (v.discountType === 'PERCENT' && (v.discountValue ?? 0) > 100) {
        ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Скидка в процентах — не больше 100' });
      }
      Object.entries(v.moduleExpirations).forEach(([code, at]) => {
        if (at && v.moduleOverrides[code] === true && Date.parse(at) <= Date.now()) {
          ctx.addIssue({
            code: 'custom',
            path: ['moduleExpirations', code],
            message: 'Срок действия должен быть в будущем',
          });
        }
      });
    });
}

export const effectiveModule = (code: string, values: SettingsFormValues, d: TariffDefaults) =>
  values.moduleOverrides[code] ?? d.modules[code] ?? false;

/** Лимиты зафиксированы в тарифе — меняются только сменой тарифного плана. */
export const effectiveLimit = (code: string, d: TariffDefaults) => d.limits[code] ?? 0;

/** Применение политики сервера к индивидуальным настройкам модулей при смене тарифа. */
export function applyOverridePolicy(
  values: SettingsFormValues,
  next: TariffDefaults,
  policy: OverridePolicy,
  lockedModules: string[] = [],
): Pick<SettingsFormValues, 'moduleOverrides'> {
  if (policy === 'RESET') {
    return { moduleOverrides: Object.fromEntries(Object.keys(values.moduleOverrides).map((c) => [c, null])) };
  }
  // KEEP_COMPATIBLE: сохраняются настройки, которые отличаются от нового тарифа
  return {
    moduleOverrides: Object.fromEntries(
      Object.entries(values.moduleOverrides).map(([c, v]) => [
        c,
        v === null || lockedModules.includes(c) || v === next.modules[c] ? null : v,
      ]),
    ),
  };
}

export const countOverrides = (v: Pick<SettingsFormValues, 'moduleOverrides'>) =>
  Object.values(v.moduleOverrides).filter((x) => x !== null).length;

export interface CriticalChange {
  key: string;
  text: string;
}

/** Изменения, требующие явного подтверждения перед сохранением. */
export function criticalChanges(
  base: OrganizationDetail,
  values: SettingsFormValues,
  nextDefaults: TariffDefaults,
): CriticalChange[] {
  const baseValues = toFormValues(base);
  const baseDefaults = defaultsFromOrganization(base);
  const out: CriticalChange[] = [];

  if (values.tariffPlanId !== base.tariffPlan.id) {
    out.push({ key: 'tariff', text: `Смена тарифа: «${base.tariffPlan.name}» → «${nextDefaults.name}»` });
  }
  if (base.subscriptionEnabled && !values.subscriptionEnabled) {
    out.push({ key: 'disabled', text: 'Подписка будет отключена — доступ организации будет заблокирован' });
  }
  if (values.subscriptionEndDate && values.subscriptionEndDate < todayIso()) {
    out.push({ key: 'expired', text: 'Дата окончания подписки уже прошла — подписка будет считаться истёкшей' });
  }
  const priceBefore = finalPrice(baseDefaults.annualPrice, base.pricing.discount);
  const priceAfter = finalPrice(nextDefaults.annualPrice, discountOf(values));
  if (priceAfter !== priceBefore) {
    out.push({ key: 'price', text: `Итоговая годовая цена: ${formatKzt(priceBefore)} → ${formatKzt(priceAfter)}` });
  }
  const disabled = base.modules.filter(
    (m) => effectiveModule(m.code, baseValues, baseDefaults) && !effectiveModule(m.code, values, nextDefaults),
  );
  if (disabled.length) {
    out.push({ key: 'modules', text: `Будут отключены модули: ${disabled.map((m) => m.name).join(', ')}` });
  }
  base.limits
    .filter((l) => effectiveLimit(l.code, nextDefaults) < effectiveLimit(l.code, baseDefaults))
    .forEach((l) =>
      out.push({
        key: `limit-${l.code}`,
        text: `Уменьшение лимита «${l.name}»: ${formatNumber(effectiveLimit(l.code, baseDefaults))} → ${formatNumber(
          effectiveLimit(l.code, nextDefaults),
        )} ${l.unit}`,
      }),
    );
  return out;
}

/** Продление: +1 год от текущей даты окончания; если подписка уже истекла — новый период с сегодняшнего дня. */
export function renewalDates(values: Pick<SettingsFormValues, 'subscriptionStartDate' | 'subscriptionEndDate'>) {
  const today = todayIso();
  const end = values.subscriptionEndDate;
  if (!end || end < today) {
    return {
      subscriptionStartDate: today,
      subscriptionEndDate: dayjs(today).add(1, 'year').subtract(1, 'day').format(API_DATE),
    };
  }
  return {
    subscriptionStartDate: values.subscriptionStartDate,
    subscriptionEndDate: dayjs(end).add(1, 'year').format(API_DATE),
  };
}
