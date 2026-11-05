import { z } from 'zod';
import type {
  OrganizationDetail,
  OrganizationLimit,
  OverridePolicy,
  SubscriptionSettingsPayload,
  TariffPlanDetail,
} from '@/api/types';
import { formatNumber, todayIso } from '@/shared/format';

export interface SettingsFormValues {
  tariffPlanId: string;
  subscriptionEnabled: boolean;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  /** null — наследование значения тарифа */
  moduleOverrides: Record<string, boolean | null>;
  limitOverrides: Record<string, number | null>;
}

/** Значения тарифа по умолчанию (из карточки или из справочника выбранного тарифа). */
export interface TariffDefaults {
  tariffPlanId: string;
  name: string;
  modules: Record<string, boolean>;
  limits: Record<string, number>;
}

export function toFormValues(org: OrganizationDetail): SettingsFormValues {
  return {
    tariffPlanId: org.tariffPlan.id,
    subscriptionEnabled: org.subscriptionEnabled,
    subscriptionStartDate: org.subscriptionStartDate,
    subscriptionEndDate: org.subscriptionEndDate,
    moduleOverrides: Object.fromEntries(org.modules.map((m) => [m.code, m.overrideEnabled])),
    limitOverrides: Object.fromEntries(org.limits.map((l) => [l.code, l.overrideValue])),
  };
}

export function defaultsFromOrganization(org: OrganizationDetail): TariffDefaults {
  return {
    tariffPlanId: org.tariffPlan.id,
    name: org.tariffPlan.name,
    modules: Object.fromEntries(org.modules.map((m) => [m.code, m.tariffEnabled])),
    limits: Object.fromEntries(org.limits.map((l) => [l.code, l.tariffValue])),
  };
}

export function defaultsFromTariff(t: TariffPlanDetail): TariffDefaults {
  return {
    tariffPlanId: t.id,
    name: t.name,
    modules: Object.fromEntries(t.modules.map((m) => [m.code, m.enabled])),
    limits: Object.fromEntries(t.limits.map((l) => [l.code, l.value])),
  };
}

export function toPayload(values: SettingsFormValues, version: number): SubscriptionSettingsPayload {
  return {
    tariffPlanId: values.tariffPlanId,
    subscriptionEnabled: values.subscriptionEnabled,
    subscriptionStartDate: values.subscriptionStartDate!,
    subscriptionEndDate: values.subscriptionEndDate!,
    moduleOverrides: Object.entries(values.moduleOverrides).map(([code, value]) => ({ code, value })),
    limitOverrides: Object.entries(values.limitOverrides).map(([code, value]) => ({ code, value })),
    version,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Схема строится по справочнику лимитов из API: тип, min и max приходят с сервера. */
export function buildSchema(limits: Pick<OrganizationLimit, 'code' | 'type' | 'min' | 'max'>[]) {
  const limitShape = Object.fromEntries(
    limits.map((l) => {
      let n = z.number({ error: 'Введите число' }).min(l.min, `Минимум — ${formatNumber(l.min)}`);
      n = n.max(l.max, `Максимум — ${formatNumber(l.max)}`);
      const field = l.type === 'integer' ? n.int('Введите целое число') : n;
      return [l.code, field.nullable()];
    }),
  );

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
      moduleOverrides: z.record(z.string(), z.boolean().nullable()),
      limitOverrides: z.object(limitShape),
    })
    .superRefine((v, ctx) => {
      if (v.subscriptionStartDate && v.subscriptionEndDate && v.subscriptionEndDate < v.subscriptionStartDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['subscriptionEndDate'],
          message: 'Дата окончания не может быть раньше даты начала',
        });
      }
    });
}

export const effectiveModule = (code: string, values: SettingsFormValues, d: TariffDefaults) =>
  values.moduleOverrides[code] ?? d.modules[code] ?? false;

export const effectiveLimit = (code: string, values: SettingsFormValues, d: TariffDefaults) =>
  values.limitOverrides[code] ?? d.limits[code] ?? 0;

/** Применение политики сервера к overrides при смене тарифа. */
export function applyOverridePolicy(
  values: SettingsFormValues,
  next: TariffDefaults,
  policy: OverridePolicy,
  limitDefs: Pick<OrganizationLimit, 'code' | 'min' | 'max'>[],
  lockedModules: string[] = [],
): Pick<SettingsFormValues, 'moduleOverrides' | 'limitOverrides'> {
  if (policy === 'RESET') {
    return {
      moduleOverrides: Object.fromEntries(Object.keys(values.moduleOverrides).map((c) => [c, null])),
      limitOverrides: Object.fromEntries(Object.keys(values.limitOverrides).map((c) => [c, null])),
    };
  }
  // KEEP_COMPATIBLE: сохраняются overrides, которые отличаются от нового тарифа и укладываются в диапазон
  return {
    moduleOverrides: Object.fromEntries(
      Object.entries(values.moduleOverrides).map(([c, v]) => [
        c,
        v === null || lockedModules.includes(c) || v === next.modules[c] ? null : v,
      ]),
    ),
    limitOverrides: Object.fromEntries(
      Object.entries(values.limitOverrides).map(([c, v]) => {
        const def = limitDefs.find((l) => l.code === c);
        const compatible = v !== null && def && v >= def.min && v <= def.max && v !== next.limits[c];
        return [c, compatible ? v : null];
      }),
    ),
  };
}

export const countOverrides = (v: Pick<SettingsFormValues, 'moduleOverrides' | 'limitOverrides'>) =>
  Object.values(v.moduleOverrides).filter((x) => x !== null).length +
  Object.values(v.limitOverrides).filter((x) => x !== null).length;

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
  const disabled = base.modules.filter(
    (m) => effectiveModule(m.code, baseValues, baseDefaults) && !effectiveModule(m.code, values, nextDefaults),
  );
  if (disabled.length) {
    out.push({ key: 'modules', text: `Будут отключены модули: ${disabled.map((m) => m.name).join(', ')}` });
  }
  const decreased = base.limits.filter(
    (l) => effectiveLimit(l.code, values, nextDefaults) < effectiveLimit(l.code, baseValues, baseDefaults),
  );
  decreased.forEach((l) =>
    out.push({
      key: `limit-${l.code}`,
      text: `Уменьшение лимита «${l.name}»: ${formatNumber(effectiveLimit(l.code, baseValues, baseDefaults))} → ${formatNumber(
        effectiveLimit(l.code, values, nextDefaults),
      )} ${l.unit}`,
    }),
  );
  return out;
}
