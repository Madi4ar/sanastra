import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Input, InputNumber, Modal, Spin, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { z } from 'zod';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { LimitDefinition, TariffPlanDetail, TariffPlanPayload, TariffPlanSummary } from '@/api/types';
import { useTariffPlans } from '@/features/organizations/queries';
import { Field } from '@/shared/FormField';
import { formatNumber } from '@/shared/format';
import { IconButton } from '@/shared/IconButton';
import { ModuleIcon } from '@/shared/ModuleIcon';
import { ErrorState } from '@/shared/PageState';
import { formatKzt } from '@/shared/pricing';

/** Справочник лимитов и модулей — из конфигурации любого тарифа (каталог одинаков для всех тарифов). */
function useCatalog(anyTariffId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tariffPlan(anyTariffId ?? ''),
    queryFn: () => api.tariffPlans.get(anyTariffId!),
    enabled: Boolean(anyTariffId),
  });
}

function buildTariffSchema(limits: LimitDefinition[]) {
  return z.object({
    name: z.string().trim().min(2, 'Название — от 2 до 60 символов').max(60, 'Название — от 2 до 60 символов'),
    code: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_-]{1,39}$/, 'Латиница в нижнем регистре, цифры, «-» и «_», от 2 символов'),
    annualPrice: z.number({ error: 'Укажите годовую цену' }).min(0, 'Цена не может быть отрицательной'),
    limits: z.object(
      Object.fromEntries(
        limits.map((l) => {
          let n = z
            .number({ error: 'Введите число' })
            .min(l.min, `Минимум — ${formatNumber(l.min)}`)
            .max(l.max, `Максимум — ${formatNumber(l.max)}`);
          if (l.type === 'integer') n = n.int('Введите целое число');
          return [l.code, n];
        }),
      ),
    ),
    modules: z.record(z.string(), z.boolean()),
  });
}

type TariffFormValues = TariffPlanPayload;

export function TariffPlansPage() {
  const tariffs = useTariffPlans();
  const catalog = useCatalog(tariffs.data?.[0]?.id);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const limitDefs = catalog.data?.limits ?? [];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Тарифные планы
          </Typography.Title>
          <Typography.Text type="secondary">
            Шаблоны тарифов с фиксированной годовой ценой, лимитами и набором модулей. Изменение шаблона применяется
            к новым назначениям и продлениям — условия уже оформленных периодов не меняются.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing({ id: null })} disabled={!catalog.data}>
          Создать новый тариф
        </Button>
      </div>

      {tariffs.isError ? (
        <ErrorState error={tariffs.error} onRetry={() => void tariffs.refetch()} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<TariffPlanSummary>
            rowKey="id"
            loading={tariffs.isPending}
            dataSource={tariffs.data}
            pagination={false}
            scroll={{ x: 1000 }}
            onRow={(t) => ({ 'data-testid': `tariff-row-${t.code}` }) as React.HTMLAttributes<HTMLElement>}
            columns={[
              {
                title: 'Тариф',
                key: 'name',
                render: (_, t) => (
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="mono text-xs text-muted">{t.code}</div>
                  </div>
                ),
              },
              {
                title: 'Годовая цена',
                dataIndex: 'annualPrice',
                key: 'price',
                width: 160,
                align: 'right',
                render: (v: number) => <span className="font-semibold">{formatKzt(v)}</span>,
              },
              ...limitDefs.map((l) => ({
                title: l.name,
                key: l.code,
                width: 170,
                render: (_: unknown, t: TariffPlanSummary) => `${formatNumber(t.limits[l.code] ?? 0)} ${l.unit}`,
              })),
              {
                title: 'Модули',
                key: 'modules',
                width: 100,
                render: (_, t) => <Tag>{t.enabledModulesCount}</Tag>,
              },
              {
                title: 'Организаций',
                dataIndex: 'organizationsCount',
                key: 'orgs',
                width: 120,
              },
              {
                title: '',
                key: 'actions',
                width: 64,
                align: 'center',
                render: (_, t) => (
                  <IconButton
                    type="text"
                    label={`Редактировать тариф «${t.name}»`}
                    icon={<Pencil size={16} />}
                    onClick={() => setEditing({ id: t.id })}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}

      {editing && catalog.data && (
        <TariffFormModal tariffId={editing.id} catalog={catalog.data} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function emptyValues(catalog: TariffPlanDetail): TariffFormValues {
  return {
    name: '',
    code: '',
    annualPrice: 0,
    limits: Object.fromEntries(catalog.limits.map((l) => [l.code, l.min])),
    modules: Object.fromEntries(catalog.modules.map((m) => [m.code, !m.canOverride])),
  };
}

function toValues(t: TariffPlanDetail): TariffFormValues {
  return {
    name: t.name,
    code: t.code,
    annualPrice: t.annualPrice,
    limits: Object.fromEntries(t.limits.map((l) => [l.code, l.value])),
    modules: Object.fromEntries(t.modules.map((m) => [m.code, m.enabled])),
  };
}

function TariffFormModal({
  tariffId,
  catalog,
  onClose,
}: {
  tariffId: string | null;
  catalog: TariffPlanDetail;
  onClose: () => void;
}) {
  const existing = useQuery({
    queryKey: queryKeys.tariffPlan(tariffId ?? ''),
    queryFn: () => api.tariffPlans.get(tariffId!),
    enabled: Boolean(tariffId),
  });
  const loading = Boolean(tariffId) && existing.isPending;

  return (
    <Modal
      open
      width={720}
      title={tariffId ? 'Редактирование тарифа' : 'Новый тариф'}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : existing.isError ? (
        <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
      ) : (
        <TariffForm
          tariffId={tariffId}
          catalog={catalog}
          initial={existing.data ? toValues(existing.data) : emptyValues(catalog)}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function TariffForm({
  tariffId,
  catalog,
  initial,
  onClose,
}: {
  tariffId: string | null;
  catalog: TariffPlanDetail;
  initial: TariffFormValues;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { control, handleSubmit, setError, formState } = useForm<TariffFormValues>({
    resolver: zodResolver(buildTariffSchema(catalog.limits)),
    mode: 'onChange',
    defaultValues: initial,
  });
  const { errors } = formState;

  const save = useMutation({
    mutationFn: (v: TariffFormValues) => (tariffId ? api.tariffPlans.update(tariffId, v) : api.tariffPlans.create(v)),
    onSuccess: (saved) => {
      qc.setQueryData(queryKeys.tariffPlan(saved.id), saved);
      void qc.invalidateQueries({ queryKey: queryKeys.tariffPlans });
      void qc.invalidateQueries({ queryKey: ['tariff-plan'] });
      void qc.invalidateQueries({ queryKey: ['organization'] });
      message.success(tariffId ? 'Тариф сохранён' : 'Тариф создан');
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === 'VALIDATION_ERROR') {
        Object.entries(e.fieldErrors).forEach(([f, msg]) =>
          setError(f as FieldPath<TariffFormValues>, { type: 'server', message: msg }),
        );
      }
      message.error(isApiError(e) ? e.message : 'Не удалось сохранить тариф');
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate aria-label="Форма тарифа" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Название тарифа" required htmlFor="tariff-name" error={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input id="tariff-name" placeholder="Например, Стандарт" {...field} status={errors.name ? 'error' : undefined} />
            )}
          />
        </Field>
        <Field label="Системный код / Slug" required htmlFor="tariff-code" error={errors.code?.message}>
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <Input
                id="tariff-code"
                className="mono"
                placeholder="standard"
                {...field}
                status={errors.code ? 'error' : undefined}
              />
            )}
          />
        </Field>
      </div>

      <Field label="Годовая цена, KZT / год" required htmlFor="tariff-price" error={errors.annualPrice?.message}>
        <Controller
          control={control}
          name="annualPrice"
          render={({ field }) => (
            <InputNumber<number>
              id="tariff-price"
              min={0}
              step={1000}
              value={Number.isNaN(field.value) ? null : field.value}
              onChange={(v) => field.onChange(v ?? Number.NaN)}
              suffix="₸"
              style={{ width: 240 }}
              status={errors.annualPrice ? 'error' : undefined}
            />
          )}
        />
      </Field>

      <div>
        <Typography.Title level={5}>Фиксированные лимиты</Typography.Title>
        <div className="grid grid-cols-3 gap-4">
          {catalog.limits.map((l) => (
            <Field
              key={l.code}
              label={l.name}
              required
              htmlFor={`tariff-limit-${l.code}`}
              error={errors.limits?.[l.code]?.message}
              hint={`${l.code}: от ${formatNumber(l.min)} до ${formatNumber(l.max)}`}
            >
              <Controller
                control={control}
                name={`limits.${l.code}`}
                render={({ field }) => (
                  <InputNumber<number>
                    id={`tariff-limit-${l.code}`}
                    value={Number.isNaN(field.value) ? null : field.value}
                    onChange={(v) => field.onChange(v ?? Number.NaN)}
                    step={l.type === 'integer' ? 1 : 0.5}
                    suffix={l.unit === 'ГБ' ? 'ГБ' : undefined}
                    style={{ width: '100%' }}
                    status={errors.limits?.[l.code] ? 'error' : undefined}
                  />
                )}
              />
            </Field>
          ))}
        </div>
      </div>

      <div>
        <Typography.Title level={5}>Базовые модули</Typography.Title>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {catalog.modules.map((m) => (
            <div key={m.code} className="flex items-center gap-3 px-3 py-2">
              <ModuleIcon name={m.icon} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-muted">{m.description}</div>
              </div>
              <Controller
                control={control}
                name={`modules.${m.code}`}
                render={({ field }) => {
                  const sw = (
                    <Switch
                      aria-label={`Модуль «${m.name}»`}
                      checked={field.value}
                      onChange={field.onChange}
                      disabled={!m.canOverride}
                      checkedChildren="ON"
                      unCheckedChildren="OFF"
                    />
                  );
                  return m.canOverride ? sw : <Tooltip title={m.lockReason}>{sw}</Tooltip>;
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Отмена</Button>
        <Button type="primary" htmlType="submit" loading={save.isPending}>
          Сохранить тариф
        </Button>
      </div>
    </form>
  );
}
