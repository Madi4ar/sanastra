import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { TARIFFS, load, toDetail, toTariffDetail } from '@/mocks/db';
import { finalPrice } from '@/shared/pricing';
import {
  applyOverridePolicy,
  buildSchema,
  criticalChanges,
  defaultsFromOrganization,
  defaultsFromTariff,
  effectiveLimit,
  effectiveModule,
  renewalDates,
  toFormValues,
  toPayload,
} from './model';

const academy = () => toDetail(load().organizations[0]!);

describe('валидация формы', () => {
  const org = academy();
  const schema = buildSchema();
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

  it('скидка: не отрицательная, в процентах — не больше 100', () => {
    expect(schema.safeParse({ ...valid, discountValue: -1 }).success).toBe(false);
    const pct = schema.safeParse({ ...valid, discountType: 'PERCENT', discountValue: 120 });
    expect(pct.error!.issues[0]!.message).toBe('Скидка в процентах — не больше 100');
    expect(schema.safeParse({ ...valid, discountType: 'AMOUNT', discountValue: 500_000 }).success).toBe(true);
  });

  it('срок действия временного модуля должен быть в будущем', () => {
    const past = dayjs().subtract(1, 'hour').toISOString();
    const r = schema.safeParse({ ...valid, moduleExpirations: { ...valid.moduleExpirations, WEBINARS: past } });
    expect(r.error!.issues[0]!.path.join('.')).toBe('moduleExpirations.WEBINARS');
  });
});

describe('цена подписки', () => {
  it('итоговая цена = max(0, базовая − скидка)', () => {
    expect(finalPrice(100_000, { type: 'AMOUNT', value: 20_000 })).toBe(80_000);
    expect(finalPrice(100_000, { type: 'PERCENT', value: 15 })).toBe(85_000);
    expect(finalPrice(100_000, { type: 'AMOUNT', value: 150_000 })).toBe(0);
  });

  it('продление: +1 год от даты окончания, после истечения — с сегодняшнего дня', () => {
    expect(renewalDates({ subscriptionStartDate: '2026-01-01', subscriptionEndDate: '2099-03-10' })).toEqual({
      subscriptionStartDate: '2026-01-01',
      subscriptionEndDate: '2100-03-10',
    });
    const today = dayjs().format('YYYY-MM-DD');
    expect(renewalDates({ subscriptionStartDate: '2020-01-01', subscriptionEndDate: '2020-12-31' })).toEqual({
      subscriptionStartDate: today,
      subscriptionEndDate: dayjs().add(1, 'year').subtract(1, 'day').format('YYYY-MM-DD'),
    });
  });
});

describe('модули и лимиты', () => {
  it('override модуля имеет приоритет над тарифом, лимиты — только из тарифа', () => {
    const org = academy();
    const values = toFormValues(org);
    const d = defaultsFromOrganization(org);
    expect(effectiveModule('WEBINARS', values, d)).toBe(true);
    expect(d.modules.WEBINARS).toBe(false);
    expect(effectiveLimit('USERS_COUNT', d)).toBe(150);
  });

  it('payload содержит скидку, модули со сроком действия и version', () => {
    const org = academy();
    const values = toFormValues(org);
    const expiresAt = dayjs().add(3, 'day').toISOString();
    const p = toPayload(
      { ...values, discountType: 'PERCENT', discountValue: 10, moduleExpirations: { ...values.moduleExpirations, WEBINARS: expiresAt, CHAT: expiresAt } },
      org.version,
      defaultsFromOrganization(org),
    );
    expect(p.version).toBe(org.version);
    expect(p.discount).toEqual({ type: 'PERCENT', value: 10 });
    expect(p.moduleOverrides).toContainEqual({ code: 'WEBINARS', value: true, expiresAt });
    // Срок задаётся только модулям, включённым сверх тарифа
    expect(p.moduleOverrides).toContainEqual({ code: 'CHAT', value: null, expiresAt: null });
    expect(p).not.toHaveProperty('limitOverrides');
  });
});

describe('политика overrides при смене тарифа', () => {
  const org = academy();
  const values = toFormValues(org);
  const business = defaultsFromTariff(toTariffDetail(TARIFFS[2]!));

  it('RESET сбрасывает индивидуальные настройки модулей', () => {
    const r = applyOverridePolicy(values, business, 'RESET');
    expect(Object.values(r.moduleOverrides).every((v) => v === null)).toBe(true);
  });

  it('KEEP_COMPATIBLE убирает настройки, совпадающие с новым тарифом', () => {
    const r = applyOverridePolicy(values, business, 'KEEP_COMPATIBLE');
    expect(r.moduleOverrides.WEBINARS).toBeNull(); // в «Бизнес» вебинары уже включены
  });
});

describe('критические изменения', () => {
  it('находит смену тарифа, отключение подписки, прошедшую дату, цену, отключение модулей и уменьшение лимитов', () => {
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
      },
      { ...defaultsFromTariff(toTariffDetail(TARIFFS[1]!)), limits: { USERS_COUNT: 100, COURSES_COUNT: 50, STORAGE_GB: 100 } },
    );
    const keys = changes.map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining(['tariff', 'disabled', 'expired', 'price', 'modules', 'limit-USERS_COUNT']));
    expect(changes.find((c) => c.key === 'price')!.text).toMatch(/^Итоговая годовая цена: 100\s000 ₸ → 200\s000 ₸$/);
  });

  it('без изменений — пустой список', () => {
    const org = academy();
    expect(criticalChanges(org, toFormValues(org), defaultsFromOrganization(org))).toEqual([]);
  });
});
