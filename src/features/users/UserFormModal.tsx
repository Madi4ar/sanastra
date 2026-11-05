import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Input, Modal, Select, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { z } from 'zod';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { PlatformUser, RoleAssignment } from '@/api/types';
import { ROLE_LABEL } from '@/features/auth/roles';
import {
  formatPhone,
  isValidPassword,
  MESSAGES,
  phoneDigits,
  registerSchema,
  type RegisterFormValues,
} from '@/features/auth/validation';
import { Field } from '@/shared/FormField';

type TextField = 'iin' | 'lastName' | 'firstName' | 'middleName' | 'email';

/** При редактировании пароль необязателен: пустое поле — пароль не меняется. */
const editSchema = registerSchema.extend({
  password: z.string().refine((v) => v === '' || isValidPassword(v), MESSAGES.password),
});

const roleKey = (r: Pick<RoleAssignment, 'role' | 'clientSlug'>) => `${r.role}:${r.clientSlug ?? ''}`;

/** Создание и редактирование пользователя суперадминистратором (поля как при регистрации). */
export function UserFormModal({ user, onClose }: { user: PlatformUser | null; onClose: () => void }) {
  const isEdit = Boolean(user);
  const qc = useQueryClient();
  const { message } = App.useApp();
  const regions = useQuery({ queryKey: queryKeys.regions, queryFn: api.dictionaries.regions, staleTime: Infinity });
  const [roles, setRoles] = useState<RoleAssignment[]>(user?.roles ?? []);

  const { control, handleSubmit, setError, formState } = useForm<RegisterFormValues>({
    resolver: zodResolver(isEdit ? editSchema : registerSchema),
    mode: 'onTouched',
    defaultValues: {
      iin: user?.iin ?? '',
      lastName: user?.lastName ?? '',
      firstName: user?.firstName ?? '',
      middleName: user?.middleName ?? '',
      region: user?.region ?? '',
      phone: user ? formatPhone(user.phone) : '',
      email: user?.email ?? '',
      password: '',
    },
  });
  const { errors } = formState;

  const save = useMutation({
    mutationFn: (v: RegisterFormValues) => {
      const payload = {
        iin: v.iin.trim(),
        lastName: v.lastName.trim(),
        firstName: v.firstName.trim(),
        middleName: v.middleName.trim() || undefined,
        region: v.region,
        phone: phoneDigits(v.phone),
        email: v.email.trim(),
        password: v.password || undefined,
      };
      return user
        ? api.platform.updateUser(user.id, { ...payload, roles: roles.map(({ role, clientSlug }) => ({ role, clientSlug })) })
        : api.platform.createUser({ ...payload, password: v.password });
    },
    onSuccess: (u) => {
      message.success(isEdit ? `Изменения сохранены: ${u.fullName}` : `Пользователь создан: ${u.fullName}`);
      void qc.invalidateQueries({ queryKey: queryKeys.platformUsersAll });
      void qc.invalidateQueries({ queryKey: ['organization-users'] });
      onClose();
    },
    onError: (e) => {
      if (isApiError(e))
        Object.entries(e.fieldErrors).forEach(([k, msg], i) => {
          if (k !== 'roles')
            setError(k as FieldPath<RegisterFormValues>, { type: 'server', message: msg }, { shouldFocus: i === 0 });
        });
    },
  });
  const fe = isApiError(save.error) ? save.error.fieldErrors : {};
  const serverError =
    isApiError(save.error) && (!Object.keys(fe).length || fe.roles) ? (fe.roles ?? save.error.message) : null;

  const text = (name: TextField, label: string, opts: { required?: boolean; placeholder?: string } = {}) => {
    const id = `user-${name}`;
    const { required = true, placeholder } = opts;
    return (
      <Field label={label} htmlFor={id} required={required} error={errors[name]?.message}>
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Input
              id={id}
              placeholder={placeholder}
              status={errors[name] ? 'error' : undefined}
              aria-invalid={Boolean(errors[name])}
              {...field}
              onChange={(e) =>
                field.onChange(name === 'iin' ? e.target.value.replace(/\D/g, '').slice(0, 12) : e.target.value)
              }
            />
          )}
        />
      </Field>
    );
  };

  return (
    <Modal
      open
      width={640}
      title={isEdit ? 'Редактирование пользователя' : 'Новый пользователь'}
      okText={isEdit ? 'Сохранить' : 'Создать'}
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => void handleSubmit((v) => save.mutate(v))()}
      onCancel={onClose}
      destroyOnHidden
    >
      <form
        className="flex flex-col gap-4 pt-2"
        noValidate
        aria-label={isEdit ? 'Редактирование пользователя' : 'Новый пользователь'}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit((v) => save.mutate(v))();
        }}
      >
        {text('iin', 'ИИН', { placeholder: '12 цифр' })}
        <div className="grid grid-cols-2 gap-4">
          {text('lastName', 'Фамилия')}
          {text('firstName', 'Имя')}
        </div>
        {text('middleName', 'Отчество', { required: false })}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Область" htmlFor="user-region" required error={errors.region?.message}>
            <Controller
              control={control}
              name="region"
              render={({ field }) => (
                <Select
                  id="user-region"
                  className="w-full"
                  placeholder="Выберите область"
                  showSearch={{ optionFilterProp: 'label' }}
                  loading={regions.isPending}
                  status={errors.region ? 'error' : undefined}
                  options={(regions.data ?? []).map((r) => ({ value: r.name, label: r.name }))}
                  value={field.value || undefined}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field label="Телефон" htmlFor="user-phone" required error={errors.phone?.message}>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  id="user-phone"
                  type="tel"
                  placeholder="+7 (XXX) XXX-XX-XX"
                  status={errors.phone ? 'error' : undefined}
                  {...field}
                  onChange={(e) => field.onChange(formatPhone(e.target.value))}
                />
              )}
            />
          </Field>
        </div>
        {text('email', 'Email', { placeholder: 'user@domain.com' })}
        <Field
          label={isEdit ? 'Новый пароль' : 'Пароль'}
          htmlFor="user-password"
          required={!isEdit}
          error={errors.password?.message}
          hint={isEdit ? 'Оставьте пустым, чтобы не менять пароль' : MESSAGES.password}
        >
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Input.Password
                id="user-password"
                autoComplete="new-password"
                status={errors.password ? 'error' : undefined}
                {...field}
              />
            )}
          />
        </Field>

        {isEdit ? (
          <div>
            <div className="mb-1.5 text-sm font-medium">Роли</div>
            <div className="flex flex-wrap gap-1" data-testid="user-roles">
              {roles.length ? (
                roles.map((r) => (
                  <Tag
                    key={roleKey(r)}
                    closable
                    closeIcon
                    onClose={(e) => {
                      e.preventDefault();
                      setRoles((list) => list.filter((x) => roleKey(x) !== roleKey(r)));
                    }}
                  >
                    {ROLE_LABEL[r.role]}
                    {r.organizationName ? ` · ${r.organizationName}` : ''}
                  </Tag>
                ))
              ) : (
                <Typography.Text type="secondary">Ролей нет</Typography.Text>
              )}
            </div>
            <div className="mt-1 text-xs text-muted">Здесь роли можно снять; назначение — кнопкой «Назначить роль».</div>
          </div>
        ) : (
          <Typography.Text type="secondary">Новому пользователю присваивается роль «Слушатель».</Typography.Text>
        )}

        {serverError && <Alert type="error" showIcon title={serverError} />}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
