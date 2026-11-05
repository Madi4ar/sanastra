import { Alert, Button, Modal, Radio, Spin, Table, Tag, Typography } from 'antd';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { OrganizationDetail, OverridePolicy, TariffPlanDetail } from '@/api/types';
import { useTariffPlan } from '@/features/organizations/queries';
import { formatNumber } from '@/shared/format';
import { ModuleIcon } from '@/shared/ModuleIcon';
import { ErrorState } from '@/shared/PageState';
import {
  applyOverridePolicy,
  countOverrides,
  defaultsFromTariff,
  effectiveLimit,
  effectiveModule,
  type SettingsFormValues,
  type TariffDefaults,
} from './model';

export const POLICY_LABEL: Record<OverridePolicy, string> = {
  KEEP_COMPATIBLE: 'Сохранить совместимые индивидуальные настройки',
  RESET: 'Сбросить все индивидуальные настройки и использовать значения нового тарифа',
};

interface Props {
  newTariffId: string;
  base: OrganizationDetail;
  values: SettingsFormValues;
  currentDefaults: TariffDefaults;
  onCancel: () => void;
  onConfirm: (next: Pick<SettingsFormValues, 'tariffPlanId' | 'moduleOverrides' | 'limitOverrides'>) => void;
}

export function TariffChangeModal(props: Props) {
  const { newTariffId, onCancel } = props;
  const tariff = useTariffPlan(newTariffId);

  return (
    <Modal
      open
      width={820}
      title="Смена тарифного плана"
      onCancel={onCancel}
      destroyOnHidden
      footer={null}
    >
      {tariff.isPending ? (
        <div className="flex justify-center py-10">
          <Spin description="Загрузка конфигурации тарифа…" />
        </div>
      ) : tariff.isError ? (
        <ErrorState error={tariff.error} onRetry={() => void tariff.refetch()} />
      ) : (
        <TariffPreview {...props} tariff={tariff.data} />
      )}
    </Modal>
  );
}

function TariffPreview({
  base,
  values,
  currentDefaults,
  tariff,
  onCancel,
  onConfirm,
}: Props & { tariff: TariffPlanDetail }) {
  const nextDefaults = defaultsFromTariff(tariff);
  const policies = tariff.overridePolicies.length ? tariff.overridePolicies : (['RESET'] as OverridePolicy[]);
  const [policy, setPolicy] = useState<OverridePolicy>(policies[0]!);
  const lockedModules = base.modules.filter((m) => !m.canOverride).map((m) => m.code);
  const overrides = applyOverridePolicy(values, nextDefaults, policy, base.limits, lockedModules);
  const after: SettingsFormValues = { ...values, tariffPlanId: tariff.id, ...overrides };
  const currentOverrides = countOverrides(values);

  const moduleRows = base.modules.map((m) => {
    const before = effectiveModule(m.code, values, currentDefaults);
    const next = effectiveModule(m.code, after, nextDefaults);
    return { ...m, before, next, changed: before !== next };
  });
  const limitRows = base.limits.map((l) => {
    const before = effectiveLimit(l.code, values, currentDefaults);
    const next = effectiveLimit(l.code, after, nextDefaults);
    return { ...l, before, next, changed: before !== next };
  });
  const changedCount = moduleRows.filter((r) => r.changed).length + limitRows.filter((r) => r.changed).length;

  const onOff = (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Включён' : 'Отключён'}</Tag>;

  return (
    <div className="flex flex-col gap-4" data-testid="tariff-preview">
      <div className="flex items-center gap-3 rounded-lg bg-subtle p-3">
        <div>
          <Typography.Text type="secondary">Текущий тариф</Typography.Text>
          <div className="text-base font-semibold">{currentDefaults.name}</div>
        </div>
        <ArrowRight size={18} aria-hidden />
        <div>
          <Typography.Text type="secondary">Новый тариф</Typography.Text>
          <div className="text-base font-semibold">{tariff.name}</div>
        </div>
        <Tag className="ml-auto" color={changedCount ? 'gold' : 'default'}>
          Изменений: {changedCount}
        </Tag>
      </div>

      {currentOverrides > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`У организации есть индивидуальные настройки: ${currentOverrides}`}
          description={
            policies.length > 1 ? (
              <Radio.Group
                className="mt-2"
                value={policy}
                onChange={(e) => setPolicy(e.target.value as OverridePolicy)}
                options={policies.map((p) => ({ value: p, label: POLICY_LABEL[p] }))}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              />
            ) : (
              `Согласно правилам тарифа: ${POLICY_LABEL[policies[0]!].toLowerCase()}.`
            )
          }
        />
      )}

      <div>
        <Typography.Title level={5}>Модули</Typography.Title>
        <Table
          size="small"
          rowKey="code"
          pagination={false}
          dataSource={moduleRows}
          columns={[
            {
              title: 'Модуль',
              dataIndex: 'name',
              render: (name: string, r) => (
                <span className="flex items-center gap-2">
                  <ModuleIcon name={r.icon} />
                  {name}
                </span>
              ),
            },
            { title: 'Сейчас', dataIndex: 'before', width: 130, render: onOff },
            { title: 'После смены', dataIndex: 'next', width: 130, render: onOff },
            {
              title: '',
              key: 'changed',
              width: 110,
              render: (_, r) => (r.changed ? <Tag color="gold">Изменится</Tag> : null),
            },
          ]}
        />
      </div>

      <div>
        <Typography.Title level={5}>Лимиты</Typography.Title>
        <Table
          size="small"
          rowKey="code"
          pagination={false}
          dataSource={limitRows}
          columns={[
            { title: 'Лимит', dataIndex: 'name' },
            { title: 'Сейчас', dataIndex: 'before', width: 160, render: (v: number, r) => `${formatNumber(v)} ${r.unit}` },
            {
              title: 'После смены',
              dataIndex: 'next',
              width: 160,
              render: (v: number, r) => (
                <span className={r.changed ? 'font-semibold' : undefined}>
                  {formatNumber(v)} {r.unit}
                </span>
              ),
            },
            {
              title: '',
              key: 'changed',
              width: 110,
              render: (_, r) =>
                r.changed ? <Tag color={r.next < r.before ? 'red' : 'gold'}>{r.next < r.before ? 'Уменьшится' : 'Изменится'}</Tag> : null,
            },
          ]}
        />
      </div>

      <Alert
        type="info"
        showIcon
        title="Изменение будет применено только после нажатия «Сохранить» в карточке организации."
      />

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Отмена</Button>
        <Button type="primary" onClick={() => onConfirm({ tariffPlanId: tariff.id, ...overrides })}>
          Применить тариф
        </Button>
      </div>
    </div>
  );
}
