import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, DatePicker, Input, Modal, Select, Switch } from 'antd';
import dayjs from 'dayjs';
import { Check, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { useTariffPlans } from '@/features/organizations/queries';
import { Field } from '@/shared/FormField';
import { API_DATE, UI_DATE } from '@/shared/format';
import { slugError, slugify } from '@/shared/slug';
import { useDebouncedValue } from '@/shared/useDebouncedValue';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Название — от 2 до 120 символов').max(120, 'Название — от 2 до 120 символов'),
    clientSlug: z.string().superRefine((v, ctx) => {
      const e = slugError(v);
      if (e) ctx.addIssue({ code: 'custom', message: e });
    }),
    tariffPlanId: z.string().min(1, 'Выберите тарифный план'),
    subscriptionEnabled: z.boolean(),
    subscriptionStartDate: z.string().min(1, 'Укажите дату начала'),
    subscriptionEndDate: z.string().min(1, 'Укажите дату окончания'),
  })
  .superRefine((v, ctx) => {
    if (v.subscriptionStartDate && v.subscriptionEndDate && v.subscriptionEndDate < v.subscriptionStartDate)
      ctx.addIssue({ code: 'custom', path: ['subscriptionEndDate'], message: 'Дата окончания не может быть раньше даты начала' });
  });

type Values = z.infer<typeof schema>;

export function CreateOrganizationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const tariffs = useTariffPlans();
  /** Пока адрес не правили вручную, он генерируется из названия */
  const [slugTouched, setSlugTouched] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      clientSlug: '',
      tariffPlanId: '',
      subscriptionEnabled: true,
      subscriptionStartDate: dayjs().format(API_DATE),
      subscriptionEndDate: dayjs().add(1, 'year').subtract(1, 'day').format(API_DATE),
    },
  });
  const { control, formState, setValue, setError, handleSubmit, reset } = form;
  const { errors, isValid } = formState;
  const slug = useWatch({ control, name: 'clientSlug' });
  const tariffId = useWatch({ control, name: 'tariffPlanId' });

  // Тариф по умолчанию — первый из каталога (каталог приходит с API)
  useEffect(() => {
    if (!tariffId && tariffs.data?.[0]) setValue('tariffPlanId', tariffs.data[0].id, { shouldValidate: true });
  }, [tariffId, tariffs.data, setValue]);

  // Проверка уникальности адреса на сервере (итоговую проверку всё равно делает POST)
  const debouncedSlug = useDebouncedValue(slug, 400);
  const slugCheck = useQuery({
    queryKey: ['slug-availability', debouncedSlug],
    queryFn: () => api.organizations.slugAvailable(debouncedSlug),
    enabled: open && !slugError(debouncedSlug),
    staleTime: 10_000,
  });
  const slugTaken = !slugError(slug) && debouncedSlug === slug && slugCheck.data?.available === false;
  const slugChecking = !slugError(slug) && (debouncedSlug !== slug || slugCheck.isFetching);

  const close = () => {
    reset();
    setSlugTouched(false);
    onClose();
  };

  const create = useMutation({
    mutationFn: (v: Values) => api.organizations.create({ ...v, name: v.name.trim() }),
    onSuccess: (org) => {
      message.success(`Организация «${org.name}» создана`);
      void qc.invalidateQueries({ queryKey: queryKeys.organizationsAll });
      qc.setQueryData(queryKeys.organization(org.tenantId), org);
      close();
      navigate(`/superadmin/organizations/${org.tenantId}`);
    },
    onError: (e) => {
      if (isApiError(e) && Object.keys(e.fieldErrors).length) {
        Object.entries(e.fieldErrors).forEach(([k, msg]) =>
          setError(k as FieldPath<Values>, { type: 'server', message: msg }, { shouldFocus: true }),
        );
      } else message.error(isApiError(e) ? e.message : 'Не удалось создать организацию');
    },
  });

  const slugStatus = slugError(slug) ? null : slugChecking ? (
    <span className="inline-flex items-center gap-1">
      <Loader2 size={12} className="animate-spin" aria-hidden /> Проверяем адрес…
    </span>
  ) : slugTaken ? null : slugCheck.data?.available ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check size={12} aria-hidden /> Адрес свободен
    </span>
  ) : null;

  return (
    <Modal
      open={open}
      title="Новая организация"
      okText="Создать"
      cancelText="Отмена"
      width={560}
      confirmLoading={create.isPending}
      okButtonProps={{ disabled: !isValid || slugTaken || create.isPending }}
      onOk={() => void handleSubmit((v) => create.mutate(v))()}
      onCancel={close}
      destroyOnHidden
    >
      <form
        className="flex flex-col gap-4 pt-2"
        noValidate
        aria-label="Создание организации"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit((v) => create.mutate(v))();
        }}
      >
        <Field label="Название" htmlFor="org-name" required error={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input
                id="org-name"
                placeholder="Например, «Учебный центр Сапа»"
                maxLength={120}
                status={errors.name ? 'error' : undefined}
                aria-invalid={Boolean(errors.name)}
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  if (!slugTouched) setValue('clientSlug', slugify(e.target.value), { shouldValidate: true });
                }}
              />
            )}
          />
        </Field>

        <Field
          label="Адрес кабинета (client_slug)"
          htmlFor="org-slug"
          required
          error={errors.clientSlug?.message ?? (slugTaken ? 'Этот адрес уже занят' : undefined)}
          hint={slugStatus ?? 'Латинские буквы, цифры и дефис. Изменить адрес после создания нельзя.'}
        >
          <Controller
            control={control}
            name="clientSlug"
            render={({ field }) => (
              <Input
                id="org-slug"
                className="mono"
                prefix={<span className="text-muted">/</span>}
                suffix={slugTaken ? <X size={14} className="text-error" aria-hidden /> : undefined}
                status={errors.clientSlug || slugTaken ? 'error' : undefined}
                aria-invalid={Boolean(errors.clientSlug) || slugTaken}
                {...field}
                onChange={(e) => {
                  setSlugTouched(true);
                  field.onChange(e.target.value.toLowerCase());
                }}
              />
            )}
          />
        </Field>

        <Field label="Тарифный план" htmlFor="org-tariff" required error={errors.tariffPlanId?.message}>
          <Controller
            control={control}
            name="tariffPlanId"
            render={({ field }) => (
              <Select
                id="org-tariff"
                aria-label="Тарифный план новой организации"
                style={{ width: '100%' }}
                loading={tariffs.isPending}
                value={field.value || undefined}
                onChange={field.onChange}
                options={(tariffs.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Дата начала" htmlFor="org-start" required error={errors.subscriptionStartDate?.message}>
            <Controller
              control={control}
              name="subscriptionStartDate"
              render={({ field }) => (
                <DatePicker
                  id="org-start"
                  format={UI_DATE}
                  style={{ width: '100%' }}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format(API_DATE) : '')}
                  status={errors.subscriptionStartDate ? 'error' : undefined}
                />
              )}
            />
          </Field>
          <Field label="Дата окончания" htmlFor="org-end" required error={errors.subscriptionEndDate?.message}>
            <Controller
              control={control}
              name="subscriptionEndDate"
              render={({ field }) => (
                <DatePicker
                  id="org-end"
                  format={UI_DATE}
                  style={{ width: '100%' }}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format(API_DATE) : '')}
                  status={errors.subscriptionEndDate ? 'error' : undefined}
                />
              )}
            />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Controller
            control={control}
            name="subscriptionEnabled"
            render={({ field }) => (
              <Switch id="org-enabled" checked={field.value} onChange={field.onChange} />
            )}
          />
          <label htmlFor="org-enabled" className="text-sm">
            Подписка включена — организация получит доступ сразу после создания
          </label>
        </div>
        <p className="m-0 text-xs text-muted">
          Модули и лимиты наследуются от тарифа. Индивидуальные настройки можно задать в карточке организации.
        </p>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
