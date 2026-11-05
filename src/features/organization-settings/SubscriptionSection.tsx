import { Alert, Card, DatePicker, Switch, Typography } from 'antd';
import dayjs from 'dayjs';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { API_DATE, formatDate, todayIso, UI_DATE } from '@/shared/format';
import type { SettingsFormValues } from './model';

interface Props {
  values: SettingsFormValues;
  control: Control<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
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

export function SubscriptionSection({ values, control, errors, disabled }: Props) {
  const today = todayIso();
  const warnings: string[] = [];
  if (!values.subscriptionEnabled) warnings.push('Подписка отключена — после сохранения доступ организации будет заблокирован.');
  if (values.subscriptionEndDate && values.subscriptionEndDate < today)
    warnings.push(`Дата окончания (${formatDate(values.subscriptionEndDate)}) уже прошла — подписка будет считаться истёкшей.`);
  if (values.subscriptionStartDate && values.subscriptionStartDate > today)
    warnings.push(`Дата начала (${formatDate(values.subscriptionStartDate)}) в будущем — до неё доступ будет закрыт.`);

  return (
    <Card title="Подписка" data-testid="subscription-section">
      <div className="grid grid-cols-3 gap-6">
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
      </div>
      {warnings.length > 0 && (
        <div className="mt-4 flex flex-col gap-2" data-testid="subscription-warnings">
          {warnings.map((w) => (
            <Alert key={w} type="warning" showIcon title={w} />
          ))}
        </div>
      )}
      <Typography.Paragraph type="secondary" className="mt-3 mb-0" style={{ fontSize: 13 }}>
        Итоговый статус организации вычисляется сервером после сохранения. Дата окончания включительна.
      </Typography.Paragraph>
    </Card>
  );
}
