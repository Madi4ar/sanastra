import { Card, InputNumber, Table, Tag, Typography } from 'antd';
import { Undo2 } from 'lucide-react';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import type { OrganizationLimit } from '@/api/types';
import { formatNumber } from '@/shared/format';
import { IconButton } from '@/shared/IconButton';
import { Legend } from './ModulesSection';
import type { SettingsFormValues, TariffDefaults } from './model';

interface Props {
  limits: OrganizationLimit[];
  values: SettingsFormValues;
  defaults: TariffDefaults;
  control: Control<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
  onReset: (code: string) => void;
  disabled?: boolean;
}

export function LimitsSection({ limits, values, defaults, control, errors, onReset, disabled }: Props) {
  return (
    <Card title="Лимиты" extra={<Legend />} styles={{ body: { padding: 0 } }} data-testid="limits-section">
      <Table<OrganizationLimit>
        rowKey="code"
        pagination={false}
        dataSource={limits}
        scroll={{ x: 980 }}
        columns={[
          {
            title: 'Лимит',
            key: 'limit',
            render: (_, l) => (
              <div>
                <div className="flex items-center gap-2">
                  <Typography.Text strong>{l.name}</Typography.Text>
                  <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
                    {l.code}
                  </Typography.Text>
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Единица: {l.unit} · допустимо от {formatNumber(l.min)} до {formatNumber(l.max)}
                  {l.type === 'integer' ? ', целое' : ''}
                </Typography.Text>
              </div>
            ),
          },
          {
            title: 'По тарифу',
            key: 'default',
            width: 150,
            render: (_, l) => (
              <Tag variant="outlined">
                {formatNumber(defaults.limits[l.code] ?? 0)} {l.unit}
              </Tag>
            ),
          },
          {
            title: 'Индивидуальное значение',
            key: 'override',
            width: 260,
            render: (_, l) => {
              const error = errors.limitOverrides?.[l.code]?.message;
              const id = `limit-${l.code}`;
              return (
                <div>
                  <Controller
                    control={control}
                    name={`limitOverrides.${l.code}`}
                    render={({ field }) => (
                      <InputNumber<number>
                        id={id}
                        aria-label={`Индивидуальное значение: ${l.name}`}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `${id}-error` : undefined}
                        placeholder="По тарифу"
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? null)}
                        onBlur={field.onBlur}
                        status={error ? 'error' : undefined}
                        disabled={disabled}
                        step={l.type === 'integer' ? 1 : 0.5}
                        style={{ width: 200 }}
                        suffix={l.unit}
                      />
                    )}
                  />
                  {error && (
                    <div id={`${id}-error`} role="alert" className="mt-1 text-xs text-error">
                      {String(error)}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            title: 'Итоговое значение',
            key: 'effective',
            width: 210,
            render: (_, l) => {
              const override = values.limitOverrides[l.code] ?? null;
              const effective = override ?? defaults.limits[l.code] ?? 0;
              return (
                <span className="flex flex-wrap items-center gap-1" data-testid={`limit-effective-${l.code}`}>
                  <Tag color="green" variant="solid">
                    {formatNumber(effective)} {l.unit}
                  </Tag>
                  {override !== null && <Tag color="blue">Индивидуально</Tag>}
                </span>
              );
            },
          },
          {
            title: '',
            key: 'actions',
            width: 64,
            align: 'center',
            render: (_, l) => (
              <IconButton
                type="text"
                label={`Вернуть значение тарифа для «${l.name}»`}
                icon={<Undo2 size={16} />}
                disabled={disabled || (values.limitOverrides[l.code] ?? null) === null}
                onClick={() => onReset(l.code)}
              />
            ),
          },
        ]}
      />
    </Card>
  );
}
