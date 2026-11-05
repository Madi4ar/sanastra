import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Input, Modal } from 'antd';
import { Check, Loader2, X } from 'lucide-react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { z } from 'zod';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { OrganizationDetail } from '@/api/types';
import { Field } from '@/shared/FormField';
import { slugError } from '@/shared/slug';
import { useDebouncedValue } from '@/shared/useDebouncedValue';

const schema = z.object({
  name: z.string().trim().min(2, 'Название — от 2 до 120 символов').max(120, 'Название — от 2 до 120 символов'),
  clientSlug: z.string().superRefine((v, ctx) => {
    const e = slugError(v);
    if (e) ctx.addIssue({ code: 'custom', message: e });
  }),
});

type Values = z.infer<typeof schema>;

/**
 * Редактирование данных, введённых при создании организации: название и адрес кабинета.
 * Тариф, подписка и даты меняются в блоке «Управление текущей подпиской».
 */
export function EditOrganizationModal({ org, onClose }: { org: OrganizationDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { control, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { name: org.name, clientSlug: org.clientSlug },
  });
  const { errors, isValid, isDirty } = formState;
  const slug = useWatch({ control, name: 'clientSlug' });
  const slugChanged = slug !== org.clientSlug;

  const debouncedSlug = useDebouncedValue(slug, 400);
  const slugCheck = useQuery({
    queryKey: ['slug-availability', debouncedSlug],
    queryFn: () => api.organizations.slugAvailable(debouncedSlug),
    enabled: slugChanged && !slugError(debouncedSlug),
    staleTime: 10_000,
  });
  const slugTaken = slugChanged && !slugError(slug) && debouncedSlug === slug && slugCheck.data?.available === false;
  const slugChecking = slugChanged && !slugError(slug) && (debouncedSlug !== slug || slugCheck.isFetching);

  const save = useMutation({
    mutationFn: (v: Values) => api.organizations.updateProfile(org.tenantId, { name: v.name.trim(), clientSlug: v.clientSlug }),
    onSuccess: (fresh) => {
      qc.setQueryData(queryKeys.organization(fresh.tenantId), fresh);
      void qc.invalidateQueries({ queryKey: queryKeys.organizationsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.platformUsersAll });
      message.success('Данные организации сохранены');
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && Object.keys(e.fieldErrors).length) {
        Object.entries(e.fieldErrors).forEach(([k, msg]) =>
          setError(k as FieldPath<Values>, { type: 'server', message: msg }, { shouldFocus: true }),
        );
      } else message.error(isApiError(e) ? e.message : 'Не удалось сохранить изменения');
    },
  });

  const slugStatus = !slugChanged || slugError(slug) ? null : slugChecking ? (
    <span className="inline-flex items-center gap-1">
      <Loader2 size={12} className="animate-spin" aria-hidden /> Проверяем адрес…
    </span>
  ) : slugTaken ? null : slugCheck.data?.available ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check size={12} aria-hidden /> Адрес свободен
    </span>
  ) : null;

  const submit = () => void handleSubmit((v) => save.mutate(v))();

  return (
    <Modal
      open
      title="Редактирование организации"
      okText="Сохранить"
      cancelText="Отмена"
      width={560}
      confirmLoading={save.isPending}
      okButtonProps={{ disabled: !isDirty || !isValid || slugTaken || slugChecking || save.isPending }}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
    >
      <form
        className="flex flex-col gap-4 pt-2"
        noValidate
        aria-label="Редактирование организации"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Название" htmlFor="edit-org-name" required error={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input
                id="edit-org-name"
                maxLength={120}
                status={errors.name ? 'error' : undefined}
                aria-invalid={Boolean(errors.name)}
                {...field}
              />
            )}
          />
        </Field>

        <Field
          label="Адрес кабинета (client_slug)"
          htmlFor="edit-org-slug"
          required
          error={errors.clientSlug?.message ?? (slugTaken ? 'Этот адрес уже занят' : undefined)}
          hint={slugStatus ?? 'Латинские буквы, цифры и дефис.'}
        >
          <Controller
            control={control}
            name="clientSlug"
            render={({ field }) => (
              <Input
                id="edit-org-slug"
                className="mono"
                prefix={<span className="text-muted">/</span>}
                suffix={slugTaken ? <X size={14} className="text-error" aria-hidden /> : undefined}
                status={errors.clientSlug || slugTaken ? 'error' : undefined}
                aria-invalid={Boolean(errors.clientSlug) || slugTaken}
                {...field}
                onChange={(e) => field.onChange(e.target.value.toLowerCase())}
              />
            )}
          />
        </Field>

        {slugChanged && (
          <Alert
            type="warning"
            showIcon
            title="Адрес кабинета изменится"
            description={`Кабинет будет доступен по адресу /${slug || '…'}/admin. Старые ссылки перестанут работать — сообщите пользователям организации новый адрес.`}
          />
        )}
      </form>
    </Modal>
  );
}
