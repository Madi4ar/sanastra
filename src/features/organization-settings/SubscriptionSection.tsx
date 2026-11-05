import { Alert, Button, Card, DatePicker, InputNumber, Select, Switch, Typography } from 'antd';
import dayjs from 'dayjs';
import { CalendarPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { API_DATE, formatDate, todayIso, UI_DATE } from '@/shared/format';
import { discountAmount, finalPrice, formatKzt } from '@/shared/pricing';
import { discountOf, type SettingsFormValues, type TariffDefaults } from './model';

interface Props {
  values: SettingsFormValues;
  control: Control<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
  /** Условия выбранного тарифа (undefined — загружаются) */
  defaults?: TariffDefaults;
  /** Цена берётся из актуальных настроек тарифа (смена тарифа / продление) */
  priceFromTariff: boolean;
  /** Поле выбора тарифного плана */
  tariffField: ReactNode;
  onRenew: () => void;
  disabled?: boolean;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <div id={id} role="alert" className="mt-1 text-xs text-error">
      {message}
    </div>
  );
}

export function SubscriptionSection({
  values,
  control,
  errors,
  defaults,
  priceFromTariff,
  tariffField,
  onRenew,
  disabled,
}: Props) {
  const today = todayIso();
  const warnings: string[] = [];
  if (!values.subscriptionEnabled) warnings.push('Подписка отключена — после сохранения доступ организации будет заблокирован.');
  if (values.subscriptionEndDate && values.subscriptionEndDate < today)
    warnings.push(`Дата окончания (${formatDate(values.subscriptionEndDate)}) уже прошла — подписка будет считаться истёкшей.`);
  if (values.subscriptionStartDate && values.subscriptionStartDate > today)
    warnings.push(`Дата начала (${formatDate(values.subscriptionStartDate)}) в будущем — до неё доступ будет закрыт.`);

  return (
    <Card title="Управление текущей подпиской" data-testid="subscription-section">
      {tariffField}

      <div className="mt-6 grid grid-cols-3 gap-6" data-testid="pricing">
        <div>
          <div className="mb-2 font-medium">Базовая годовая цена</div>
          <div className="flex h-10 items-center text-base font-semibold" data-testid="base-price">
            {defaults ? formatKzt(defaults.annualPrice) : '…'}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {priceFromTariff ? 'из настроек тарифа' : 'зафиксирована при оформлении периода'}
          </Typography.Text>
        </div>
        <div>
          <label htmlFor="discountValue" className="mb-2 block font-medium">
            Ручная скидка
          </label>
          <div className="flex gap-2">
            <Controller
              control={control}
              name="discountValue"
              render={({ field }) => (
                <InputNumber<number>
                  id="discountValue"
                  aria-label="Ручная скидка"
                  aria-invalid={Boolean(errors.discountValue)}
                  min={0}
                  placeholder="0"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? null)}
                  onBlur={field.onBlur}
                  status={errors.discountValue ? 'error' : undefined}
                  disabled={disabled}
                  style={{ flex: 1 }}
                />
              )}
            />
            <Controller
              control={control}
              name="discountType"
              render={({ field }) => (
                <Select
                  aria-label="Тип скидки"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disabled}
                  style={{ width: 90 }}
                  options={[
                    { value: 'AMOUNT', label: 'KZT' },
                    { value: 'PERCENT', label: '%' },
                  ]}
                />
              )}
            />
          </div>
          <FieldError id="discount-error" message={errors.discountValue?.message} />
          {defaults && values.discountType === 'PERCENT' && (values.discountValue ?? 0) > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              = {formatKzt(discountAmount(defaults.annualPrice, discountOf(values)))}
            </Typography.Text>
          )}
        </div>
        <div>
          <div className="mb-2 font-medium">Итоговая годовая цена</div>
          <div className="flex h-10 items-center text-xl font-semibold text-primary" data-testid="final-price">
            {defaults ? formatKzt(finalPrice(defaults.annualPrice, discountOf(values))) : '…'}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            max(0, базовая цена − скидка)
          </Typography.Text>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 items-start gap-6">
        <div>
          <label htmlFor="subscriptionEnabled" className="mb-2 block font-medium">
            Подписка включена
          </label>
          <Controller
            control={control}
            name="subscriptionEnabled"
            render={({ field }) => (
              <Switch
                id="subscriptionEnabled"
                checked={field.value}
                onChange={field.onChange}
                disabled={disabled}
                checkedChildren="Вкл"
                unCheckedChildren="Выкл"
              />
            )}
          />
        </div>
        <div>
          <label htmlFor="subscriptionStartDate" className="mb-2 block font-medium">
            Дата начала <span className="text-error">*</span>
          </label>
          <Controller
            control={control}
            name="subscriptionStartDate"
            render={({ field }) => (
              <DatePicker
                id="subscriptionStartDate"
                aria-required
                aria-describedby={errors.subscriptionStartDate ? 'start-error' : undefined}
                format={UI_DATE}
                placeholder="ДД.ММ.ГГГГ"
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d ? d.format(API_DATE) : null)}
                onBlur={field.onBlur}
                status={errors.subscriptionStartDate ? 'error' : undefined}
                disabled={disabled}
                style={{ width: '100%' }}
              />
            )}
          />
          <FieldError id="start-error" message={errors.subscriptionStartDate?.message} />
        </div>
        <div>
          <label htmlFor="subscriptionEndDate" className="mb-2 block font-medium">
            Дата окончания <span className="text-error">*</span>
          </label>
          <Controller
            control={control}
            name="subscriptionEndDate"
            render={({ field }) => (
              <DatePicker
                id="subscriptionEndDate"
                aria-required
                aria-describedby={errors.subscriptionEndDate ? 'end-error' : undefined}
                format={UI_DATE}
                placeholder="ДД.ММ.ГГГГ"
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d ? d.format(API_DATE) : null)}
                onBlur={field.onBlur}
                status={errors.subscriptionEndDate ? 'error' : undefined}
                disabled={disabled}
                style={{ width: '100%' }}
              />
            )}
          />
          <FieldError id="end-error" message={errors.subscriptionEndDate?.message} />
        </div>
        <div>
          <div className="mb-2 block font-medium">Продление</div>
          <Button icon={<CalendarPlus size={16} />} onClick={onRenew} disabled={disabled}>
            Продлить подписку (+1 год)
          </Button>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="mt-4 flex flex-col gap-2" data-testid="subscription-warnings">
          {warnings.map((w) => (
            <Alert key={w} type="warning" showIcon title={w} />
          ))}
        </div>
      )}
      <Typography.Paragraph type="secondary" className="mt-3 mb-0" style={{ fontSize: 13 }}>
        Итоговый статус организации вычисляется сервером после сохранения. Дата окончания включительна. Продление и смена тарифа фиксируют актуальные цену и лимиты тарифа и добавляют запись в историю.
      </Typography.Paragraph>
    </Card>
  );
}
