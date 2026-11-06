import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Badge, Button, Card, Modal, Select, Spin, Typography } from 'antd';
import { Save, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useBlocker } from 'react-router';
import { isApiError, type ApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { OrganizationDetail } from '@/api/types';
import { useTariffPlan, useTariffPlans } from '@/features/organizations/queries';
import { broadcastTenantAccessInvalidated } from '@/shared/crossTab';
import { formatDateTime, SOURCE_LABEL } from '@/shared/format';
import { HistorySection } from './HistorySection';
import {
  buildSchema,
  criticalChanges,
  defaultsFromOrganization,
  defaultsFromTariff,
  renewalDates,
  toFormValues,
  toPayload,
  type CriticalChange,
  type SettingsFormValues,
  type TariffDefaults,
} from './model';
import { LimitsSection } from './LimitsSection';
import { ModulesSection } from './ModulesSection';
import { OrganizationHeader } from './OrganizationHeader';
import { SubscriptionSection } from './SubscriptionSection';
import { RoleAccessSection } from './RoleAccessSection';
import { UsageSection } from './UsageSection';
import { TariffChangeModal } from './TariffChangeModal';

/** Блок «Лимиты» (только чтение, значения тарифа) временно скрыт — включить, вернув true. */
const SHOW_LIMITS_SECTION = false;

interface Props {
  /** Последние данные с сервера (могут обновляться извне — оплата, другой администратор). */
  org: OrganizationDetail;
  onReloadLatest: () => Promise<OrganizationDetail | undefined>;
}

export function OrganizationEditor({ org, onReloadLatest }: Props) {
  const qc = useQueryClient();
  const { message, notification } = App.useApp();

  /** Снимок, от которого начато редактирование. Его version отправляется при сохранении. */
  const [base, setBase] = useState(org);
  const [pendingTariffId, setPendingTariffId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ values: SettingsFormValues; changes: CriticalChange[] } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);

  const schema = useMemo(() => buildSchema(), []);
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: toFormValues(base),
  });
  const { control, formState, reset, setValue, setError, handleSubmit } = form;
  const { isDirty, isValid, errors } = formState;
  const values = useWatch({ control }) as SettingsFormValues;

  const tariffs = useTariffPlans();
  const tariffChanged = values.tariffPlanId !== base.tariffPlan.id;
  const renewed = Boolean(values.subscriptionEndDate && values.subscriptionEndDate > base.subscriptionEndDate);
  // Смена тарифа и продление оформляются по актуальным условиям тарифа (цена, лимиты)
  const termsFromTariff = tariffChanged || renewed;
  const selectedTariff = useTariffPlan(termsFromTariff ? values.tariffPlanId : undefined);
  const defaults: TariffDefaults | undefined = !termsFromTariff
    ? defaultsFromOrganization(base)
    : selectedTariff.data
      ? defaultsFromTariff(selectedTariff.data)
      : undefined;

  const applySnapshot = (fresh: OrganizationDetail) => {
    setBase(fresh);
    reset(toFormValues(fresh));
  };

  /** Сервер ушёл вперёд, а в форме есть правки — нельзя молча сохранять поверх. */
  const externalUpdate = org.version !== base.version && isDirty ? org : null;

  // Внешнее изменение при чистой форме — применяем свежие данные автоматически.
  // reset() синхронизирует внешний store react-hook-form, поэтому это эффект.
  useEffect(() => {
    if (org.version === base.version || isDirty) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applySnapshot(org);
    if (org.updatedBy === 'SYSTEM_PAYMENT') message.info('Настройки обновлены платёжным сервисом');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, isDirty, base.version]);

  const save = useMutation({
    mutationFn: (v: SettingsFormValues) =>
      api.organizations.saveSettings(base.tenantId, toPayload(v, base.version, defaults ?? defaultsFromOrganization(base))),
    onSuccess: (fresh) => {
      applySnapshot(fresh);
      qc.setQueryData(queryKeys.organization(fresh.tenantId), fresh);
      void qc.invalidateQueries({ queryKey: queryKeys.organizationsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantAccessAll });
      broadcastTenantAccessInvalidated();
      message.success('Изменения сохранены');
    },
    onError: (error, v) => handleSaveError(error, v),
  });

  function handleSaveError(error: unknown, v: SettingsFormValues) {
    if (!isApiError(error)) {
      message.error('Не удалось сохранить изменения.');
      return;
    }
    switch (error.code) {
      case 'VALIDATION_ERROR':
        applyFieldErrors(error);
        message.error(error.message);
        break;
      case 'CONFLICT':
        setConflict(true);
        break;
      case 'UNAUTHORIZED':
        break; // глобальный обработчик перенаправит на вход
      case 'SERVER_ERROR':
      case 'NETWORK_ERROR':
        notification.error({
          key: 'save-error',
          title: 'Изменения не сохранены',
          description: `${error.message} Введённые данные сохранены в форме.`,
          actions: (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                notification.destroy('save-error');
                save.mutate(v);
              }}
            >
              Повторить
            </Button>
          ),
        });
        break;
      default:
        message.error(error.message);
    }
  }

  function applyFieldErrors(error: ApiError) {
    Object.entries(error.fieldErrors).forEach(([field, msg]) => {
      setError(field as FieldPath<SettingsFormValues>, { type: 'server', message: msg }, { shouldFocus: true });
    });
  }

  const submit = handleSubmit((v) => {
    if (save.isPending || !defaults) return;
    const changes = criticalChanges(base, v, defaults);
    if (changes.length) setConfirm({ values: v, changes });
    else save.mutate(v);
  });

  const reloadLatest = async () => {
    setReloading(true);
    try {
      const fresh = (await onReloadLatest()) ?? externalUpdate;
      if (fresh) applySnapshot(fresh);
      setConflict(false);
    } finally {
      setReloading(false);
    }
  };

  // Защита от потери несохранённых изменений
  /** После удаления организации уход со страницы не требует подтверждения */
  const deletedRef = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !deletedRef.current && isDirty && !save.isPending && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const busy = save.isPending;
  const hasErrors = Object.keys(errors).length > 0;
  const canSave = isDirty && isValid && !hasErrors && !busy && Boolean(defaults);

  return (
    <form onSubmit={submit} noValidate aria-label="Настройки подписки организации">
      <div className="flex flex-col gap-4 pb-4">
        <OrganizationHeader org={org} onDeleted={() => (deletedRef.current = true)} />

        {externalUpdate && (
          <Alert
            type="warning"
            showIcon
            data-testid="external-update-alert"
            title="Настройки организации изменены извне"
            description={`Источник: ${SOURCE_LABEL[externalUpdate.updatedBy]}, ${formatDateTime(
              externalUpdate.updatedAt,
            )}. Ваши несохранённые изменения основаны на устаревшей версии и не могут быть сохранены поверх.`}
            action={
              <Button onClick={() => void reloadLatest()} loading={reloading}>
                Загрузить актуальные данные
              </Button>
            }
          />
        )}

        <SubscriptionSection
          values={values}
          control={control}
          errors={errors}
          defaults={defaults}
          priceFromTariff={termsFromTariff}
          disabled={busy}
          onRenew={() => {
            const next = renewalDates(values);
            setValue('subscriptionStartDate', next.subscriptionStartDate, { shouldDirty: true, shouldValidate: true });
            setValue('subscriptionEndDate', next.subscriptionEndDate, { shouldDirty: true, shouldValidate: true });
          }}
          tariffField={
            <div>
              <div className="flex items-end gap-4">
                <div style={{ width: 320 }}>
                  <label htmlFor="tariffPlanId" className="mb-2 block font-medium">
                    Тарифный план <span className="text-error">*</span>
                  </label>
                  <Select
                    id="tariffPlanId"
                    aria-label="Тарифный план"
                    style={{ width: '100%' }}
                    value={values.tariffPlanId}
                    loading={tariffs.isPending}
                    disabled={busy}
                    status={errors.tariffPlanId ? 'error' : undefined}
                    options={(tariffs.data ?? [{ ...base.tariffPlan }]).map((t) => ({ value: t.id, label: t.name }))}
                    onChange={(id: string) => {
                      if (id !== values.tariffPlanId) setPendingTariffId(id);
                    }}
                  />
                  {errors.tariffPlanId && (
                    <div role="alert" className="mt-1 text-xs text-error">
                      {errors.tariffPlanId.message}
                    </div>
                  )}
                </div>
                {tariffChanged && (
                  <Typography.Text type="warning" className="pb-1">
                    Будет изменён с «{base.tariffPlan.name}» после сохранения
                  </Typography.Text>
                )}
              </div>
              {tariffs.isError && (
                <Alert className="mt-3" type="error" showIcon title="Не удалось загрузить список тарифов" />
              )}
            </div>
          }
        />

        {defaults ? (
          <>
            <ModulesSection
              modules={base.modules}
              values={values}
              defaults={defaults}
              control={control}
              errors={errors.moduleExpirations}
              disabled={busy}
            />
            {SHOW_LIMITS_SECTION && (
              <LimitsSection limits={base.limits} defaults={defaults} pending={termsFromTariff} />
            )}
          </>
        ) : (
          <Card>
            <Spin description="Загрузка конфигурации тарифа…" />
          </Card>
        )}

        <HistorySection history={org.history} />
        <UsageSection usage={org.usage} />
        <RoleAccessSection tenantId={org.tenantId} version={org.version} />
      </div>

      {/* Закреплённая панель сохранения */}
      <div
        className="sticky bottom-0 z-10 -mx-6 flex items-center justify-between border-t border-border bg-surface px-6 py-3"
        style={{ boxShadow: '0 -4px 12px rgba(15,23,42,0.06)' }}
        data-testid="save-bar"
      >
        <span aria-live="polite">
          {isDirty ? (
            <Badge status="warning" text="Есть несохранённые изменения" />
          ) : (
            <Badge status="default" text="Изменений нет" />
          )}
        </span>
        <div className="flex gap-2">
          <Button onClick={() => reset(toFormValues(base))} disabled={!isDirty || busy}>
            Отменить
          </Button>
          <Button type="primary" htmlType="submit" icon={<Save size={16} />} loading={busy} disabled={!canSave}>
            Сохранить
          </Button>
        </div>
      </div>

      {pendingTariffId && defaults && (
        <TariffChangeModal
          newTariffId={pendingTariffId}
          base={base}
          values={values}
          currentDefaults={defaults}
          onCancel={() => setPendingTariffId(null)}
          onConfirm={(next) => {
            setValue('tariffPlanId', next.tariffPlanId, { shouldDirty: true, shouldValidate: true });
            Object.entries(next.moduleOverrides).forEach(([c, v]) =>
              setValue(`moduleOverrides.${c}`, v, { shouldDirty: true }),
            );
            setPendingTariffId(null);
          }}
        />
      )}

      <Modal
        open={Boolean(confirm)}
        title={
          <span className="flex items-center gap-2">
            <TriangleAlert size={18} className="text-warning" aria-hidden />
            Подтвердите критические изменения
          </span>
        }
        okText="Сохранить изменения"
        cancelText="Вернуться"
        okButtonProps={{ danger: true }}
        onCancel={() => setConfirm(null)}
        onOk={() => {
          if (confirm && !save.isPending) save.mutate(confirm.values);
          setConfirm(null);
        }}
      >
        <Typography.Paragraph>Следующие изменения повлияют на доступ организации:</Typography.Paragraph>
        <ul className="list-disc pl-5" data-testid="critical-changes">
          {confirm?.changes.map((c) => (
            <li key={c.key}>{c.text}</li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={conflict}
        title="Конфликт версий"
        okText="Загрузить актуальные данные"
        cancelText="Вернуться к редактированию"
        confirmLoading={reloading}
        onOk={() => void reloadLatest()}
        onCancel={() => setConflict(false)}
      >
        <Typography.Paragraph>
          Настройки организации были изменены другим пользователем или платёжным сервисом после того, как вы открыли
          карточку. Ваши изменения не сохранены.
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          Загрузка актуальных данных отменит ваши несохранённые правки.
        </Typography.Paragraph>
      </Modal>

      <Modal
        open={blocker.state === 'blocked'}
        title="Есть несохранённые изменения"
        okText="Уйти без сохранения"
        cancelText="Остаться"
        okButtonProps={{ danger: true }}
        onOk={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      >
        Если уйти со страницы, внесённые изменения будут потеряны.
      </Modal>
    </form>
  );
}
