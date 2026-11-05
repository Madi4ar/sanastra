import { Card, Segmented, Table, Tag, Tooltip, Typography } from 'antd';
import { Lock } from 'lucide-react';
import { Controller, type Control } from 'react-hook-form';
import type { OrganizationModule } from '@/api/types';
import { ModuleIcon } from '@/shared/ModuleIcon';
import type { SettingsFormValues, TariffDefaults } from './model';

type Choice = 'on' | 'off';

export function OnOffTag({ value, strong }: { value: boolean; strong?: boolean }) {
  return (
    <Tag color={strong ? (value ? 'green' : 'red') : 'default'} variant={strong ? 'solid' : 'outlined'}>
      {value ? 'Включён' : 'Отключён'}
    </Tag>
  );
}

interface Props {
  modules: OrganizationModule[];
  values: SettingsFormValues;
  defaults: TariffDefaults;
  control: Control<SettingsFormValues>;
  disabled?: boolean;
}

export function ModulesSection({ modules, values, defaults, control, disabled }: Props) {
  return (
    <Card
      title="Модули"
      extra={<Legend />}
      styles={{ body: { padding: 0 } }}
      data-testid="modules-section"
    >
      <Table<OrganizationModule>
        rowKey="code"
        pagination={false}
        dataSource={modules}
        scroll={{ x: 980 }}
        onRow={(m) => ({ 'data-testid': `module-row-${m.code}` }) as React.HTMLAttributes<HTMLElement>}
        columns={[
          {
            title: 'Модуль',
            key: 'module',
            render: (_, m) => (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-text">
                  <ModuleIcon name={m.icon} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Typography.Text strong>{m.name}</Typography.Text>
                    <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
                      {m.code}
                    </Typography.Text>
                  </div>
                  {m.description && (
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {m.description}
                    </Typography.Text>
                  )}
                </div>
              </div>
            ),
          },
          {
            title: 'По тарифу',
            key: 'default',
            width: 120,
            render: (_, m) => (
              <span data-testid={`module-default-${m.code}`}>
                <OnOffTag value={defaults.modules[m.code] ?? false} />
              </span>
            ),
          },
          {
            title: 'Индивидуальное значение',
            key: 'override',
            width: 220,
            render: (_, m) => {
              const control_ = (
                <Controller
                  control={control}
                  name={`moduleOverrides.${m.code}`}
                  render={({ field }) => (
                    <Segmented<Choice>
                      aria-label={`Индивидуальное значение модуля «${m.name}»`}
                      value={(field.value ?? defaults.modules[m.code] ?? false) ? 'on' : 'off'}
                      disabled={!m.canOverride || disabled}
                      // Совпадает со значением тарифа — override не нужен (null = наследование)
                      onChange={(c) => {
                        const next = c === 'on';
                        field.onChange(next === (defaults.modules[m.code] ?? false) ? null : next);
                      }}
                      options={[
                        { label: 'Включён', value: 'on' },
                        { label: 'Отключён', value: 'off' },
                      ]}
                    />
                  )}
                />
              );
              if (m.canOverride) return control_;
              return (
                <Tooltip title={m.lockReason ?? 'Модуль нельзя изменить'}>
                  <span className="inline-flex items-center gap-2" tabIndex={0} aria-label={m.lockReason}>
                    <Lock size={14} aria-hidden />
                    {control_}
                  </span>
                </Tooltip>
              );
            },
          },
          {
            title: 'Итоговое значение',
            key: 'effective',
            width: 210,
            render: (_, m) => {
              const override = values.moduleOverrides[m.code] ?? null;
              const effective = override ?? defaults.modules[m.code] ?? false;
              return (
                <span className="flex flex-wrap items-center gap-1" data-testid={`module-effective-${m.code}`}>
                  <OnOffTag value={effective} strong />
                  {override !== null && <Tag color="blue">Индивидуально</Tag>}
                </span>
              );
            },
          },
        ]}
      />
    </Card>
  );
}

export function Legend() {
  return (
    <span className="hidden items-center gap-2 text-xs text-muted lg:flex">
      <Tag variant="outlined">по тарифу</Tag>
      <Tag color="blue">индивидуально</Tag>
      <Tag color="green" variant="solid">
        итог
      </Tag>
    </span>
  );
}
