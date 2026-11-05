import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Input, Select, Typography } from 'antd';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { homeFor } from '@/auth/auth';
import { formatPhone, phoneDigits, registerSchema, type RegisterFormValues } from '@/features/auth/validation';
import { Field } from '@/shared/FormField';
import { AuthLayout } from './LoginPage';

type TextField = 'iin' | 'lastName' | 'firstName' | 'middleName' | 'email';

/** Единая форма регистрации. Новому пользователю автоматически присваивается роль «Слушатель». */
export function RegisterPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const regions = useQuery({ queryKey: queryKeys.regions, queryFn: api.dictionaries.regions, staleTime: Infinity });

  const { control, handleSubmit, setError, formState } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { iin: '', lastName: '', firstName: '', middleName: '', region: '', phone: '', email: '', password: '' },
  });
  const { errors } = formState;

  const register = useMutation({
    mutationFn: (v: RegisterFormValues) =>
      api.auth.register({
        iin: v.iin.trim(),
        lastName: v.lastName.trim(),
        firstName: v.firstName.trim(),
        middleName: v.middleName.trim() || undefined,
        region: v.region,
        phone: phoneDigits(v.phone),
        email: v.email.trim(),
        password: v.password,
      }),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, user);
      // После регистрации — личный кабинет, раздел «Профиль»
      navigate(`${homeFor(user)}/profile`, { replace: true });
    },
    onError: (e) => {
      if (isApiError(e))
        Object.entries(e.fieldErrors).forEach(([k, msg], i) =>
          setError(k as FieldPath<RegisterFormValues>, { type: 'server', message: msg }, { shouldFocus: i === 0 }),
        );
    },
  });
  const serverError = isApiError(register.error) && !Object.keys(register.error.fieldErrors).length ? register.error : null;

  const text = (name: TextField, label: string, props: { required?: boolean; placeholder?: string; inputMode?: 'numeric' | 'email'; autoComplete?: string; maxLength?: number } = {}) => {
    const id = `reg-${name}`;
    const { required = true, ...inputProps } = props;
    return (
      <Field label={label} htmlFor={id} required={required} error={errors[name]?.message}>
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Input
              id={id}
              size="large"
              status={errors[name] ? 'error' : undefined}
              aria-invalid={Boolean(errors[name])}
              {...inputProps}
              {...field}
              onChange={(e) => field.onChange(name === 'iin' ? e.target.value.replace(/\D/g, '').slice(0, 12) : e.target.value)}
            />
          )}
        />
      </Field>
    );
  };

  return (
    <AuthLayout wide>
      <Typography.Title level={2} style={{ margin: 0 }}>
        Регистрация
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 24 }}>
        Заполните данные, чтобы создать учётную запись.
      </Typography.Paragraph>

      <form
        className="flex flex-col gap-4"
        noValidate
        aria-label="Регистрация"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit((v) => register.mutate(v))();
        }}
      >
        {text('iin', 'ИИН', { placeholder: '12 цифр', inputMode: 'numeric', autoComplete: 'off' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text('lastName', 'Фамилия', { autoComplete: 'family-name', maxLength: 100 })}
          {text('firstName', 'Имя', { autoComplete: 'given-name', maxLength: 100 })}
        </div>
        {text('middleName', 'Отчество', { required: false, autoComplete: 'additional-name', maxLength: 100 })}

        <Field label="Область" htmlFor="reg-region" required error={errors.region?.message}>
          <Controller
            control={control}
            name="region"
            render={({ field }) => (
              <Select
                id="reg-region"
                size="large"
                className="w-full"
                placeholder="Выберите область"
                showSearch={{ optionFilterProp: 'label' }}
                loading={regions.isPending}
                status={errors.region ? 'error' : undefined}
                aria-invalid={Boolean(errors.region)}
                options={(regions.data ?? []).map((r) => ({ value: r.name, label: r.name }))}
                value={field.value || undefined}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>

        <Field label="Телефон" htmlFor="reg-phone" required error={errors.phone?.message}>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                id="reg-phone"
                size="large"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 (XXX) XXX-XX-XX"
                status={errors.phone ? 'error' : undefined}
                aria-invalid={Boolean(errors.phone)}
                {...field}
                onChange={(e) => field.onChange(formatPhone(e.target.value))}
              />
            )}
          />
        </Field>

        {text('email', 'Email', { inputMode: 'email', autoComplete: 'email', placeholder: 'user@domain.com' })}

        <Field
          label="Пароль"
          htmlFor="reg-password"
          required
          error={errors.password?.message}
          hint="Минимум 8 символов, хотя бы одна цифра и одна заглавная буква"
        >
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Input.Password
                id="reg-password"
                size="large"
                autoComplete="new-password"
                status={errors.password ? 'error' : undefined}
                aria-invalid={Boolean(errors.password)}
                {...field}
              />
            )}
          />
        </Field>

        {serverError && <Alert type="error" showIcon title={serverError.message} />}

        <Button type="primary" size="large" htmlType="submit" block loading={register.isPending}>
          Зарегистрироваться
        </Button>
      </form>

      <p className="mt-6 mb-0 text-center text-sm text-muted">
        Уже есть учётная запись?{' '}
        <Link to="/login" className="font-medium text-primary">
          Войти
        </Link>
      </p>
    </AuthLayout>
  );
}
