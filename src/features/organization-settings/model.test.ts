import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { TARIFFS, load, toDetail, toTariffDetail } from '@/mocks/db';
import {
  applyOverridePolicy,
  buildSchema,
  criticalChanges,
  defaultsFromOrganization,
  defaultsFromTariff,
  effectiveLimit,
  effectiveModule,
  toFormValues,
  toPayload,
} from './model';

const academy = () => toDetail(load().organizations[0]!);

describe('валидация формы', () => {
  const org = academy();
  const schema = buildSchema(org.limits);
  const valid = toFormValues(org);

  it('принимает корректные данные', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('требует обе даты', () => {
    const r = schema.safeParse({ ...valid, subscriptionStartDate: null, subscriptionEndDate: null });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['subscriptionStartDate', 'subscriptionEndDate']));
  });

  it('дата окончания не раньше даты начала', () => {
    const r = schema.safeParse({ ...valid, subscriptionStartDate: '2026-05-10', subscriptionEndDate: '2026-05-01' });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe('Дата окончания не может быть раньше даты начала');
  });

  it('лимит проверяется по min/max и типу из API', () => {
    const tooBig = schema.safeParse({ ...valid, limitOverrides: { ...valid.limitOverrides, USERS_COUNT: 10001 } });
    expect(tooBig.error!.issues[0]!.message).toMatch(/Максимум/);
    const fractional = schema.safeParse({ ...valid, limitOverrides: { ...valid.limitOverrides, USERS_COUNT: 1.5 } });
    expect(fractional.error!.issues[0]!.message).toBe('Введите целое число');
    const decimalOk = schema.safeParse({ ...valid, limitOverrides: { ...valid.limitOverrides, STORAGE_GB: 1.5 } });
    expect(decimalOk.success).toBe(true);
  });

  it('null у лимита означает наследование тарифа', () => {
    const r = schema.safeParse({ ...valid, limitOverrides: { USERS_COUNT: null, COURSES_COUNT: null, STORAGE_GB: null } });
    expect(r.success).toBe(true);
  });
});

describe('default / override / effective', () => {
  it('override имеет приоритет над значением тарифа', () => {
    const org = academy();
    const values = toFormValues(org);
    const d = defaultsFromOrganization(org);
    expect(d.limits.USERS_COUNT).toBe(50);
    expect(effectiveLimit('USERS_COUNT', values, d)).toBe(150);
    expect(effectiveModule('WEBINARS', values, d)).toBe(true);
    expect(d.modules.WEBINARS).toBe(false);
  });

  it('payload содержит overrides и version', () => {
    const org = academy();
    const p = toPayload(toFormValues(org), org.version);
    expect(p.version).toBe(org.version);
    expect(p.moduleOverrides).toContainEqual({ code: 'WEBINARS', value: true });
    expect(p.limitOverrides).toContainEqual({ code: 'STORAGE_GB', value: null });
  });
});

describe('политика overrides при смене тарифа', () => {
  const org = academy();
  const values = toFormValues(org);
  const business = defaultsFromTariff(toTariffDetail(TARIFFS[2]!));

  it('RESET сбрасывает все overrides', () => {
    const r = applyOverridePolicy(values, business, 'RESET', org.limits);
    expect(Object.values(r.moduleOverrides).every((v) => v === null)).toBe(true);
    expect(Object.values(r.limitOverrides).every((v) => v === null)).toBe(true);
  });

  it('KEEP_COMPATIBLE убирает overrides, совпадающие с новым тарифом', () => {
    const r = applyOverridePolicy(values, business, 'KEEP_COMPATIBLE', org.limits);
    expect(r.moduleOverrides.WEBINARS).toBeNull(); // в «Бизнес» вебинары уже включены
    expect(r.limitOverrides.USERS_COUNT).toBe(150); // 150 ≠ 1000 — сохраняется
  });
});

describe('критические изменения', () => {
  it('находит смену тарифа, отключение подписки, прошедшую дату, отключение модулей и уменьшение лимитов', () => {
    const org = academy();
    const v = toFormValues(org);
    const changes = criticalChanges(
      org,
      {
        ...v,
        tariffPlanId: TARIFFS[1]!.id,
        subscriptionEnabled: false,
        subscriptionEndDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        moduleOverrides: { ...v.moduleOverrides, WEBINARS: null },
        limitOverrides: { ...v.limitOverrides, USERS_COUNT: null },
      },
      defaultsFromTariff(toTariffDetail(TARIFFS[1]!)),
    );
    const keys = changes.map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining(['tariff', 'disabled', 'expired', 'modules', 'limit-USERS_COUNT']));
  });

  it('без изменений — пустой список', () => {
    const org = academy();
    expect(criticalChanges(org, toFormValues(org), defaultsFromOrganization(org))).toEqual([]);
  });
});
